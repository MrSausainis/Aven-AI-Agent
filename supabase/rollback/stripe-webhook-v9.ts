// ============================================================================
// stripe-webhook - Supabase Edge Function
// Phase 3 subscription lifecycle policy
//
// Stripe authenticates this endpoint with its webhook signature, so Supabase
// JWT verification must remain disabled for this function.
//
// Entitlement policy:
// - active / trialing: grant the tier from Stripe Price/Product metadata
// - past_due: keep current access during Stripe's recovery/grace window
// - paused: move to AVEN's suspended tier
// - incomplete / incomplete_expired / unpaid / canceled: move to free
// - subscription.deleted: move to free
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.0.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function updateEntitlementByUserId(
  userId: string,
  values: Record<string, unknown>,
  context: string,
) {
  const { data, error } = await supabaseAdmin
    .from("entitlements")
    .update(values)
    .eq("id", userId)
    .select("id");

  if (error) throw new Error(`${context}: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(`${context}: no entitlement row matched user ${userId}`);
  }
}

async function updateEntitlementByCustomerId(
  customerId: string,
  values: Record<string, unknown>,
  context: string,
) {
  const { data, error } = await supabaseAdmin
    .from("entitlements")
    .update(values)
    .eq("stripe_customer_id", customerId)
    .select("id");

  if (error) throw new Error(`${context}: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(`${context}: no entitlement row matched Stripe customer ${customerId}`);
  }
}

function subscriptionCustomerId(sub: Stripe.Subscription): string {
  return typeof sub.customer === "string" ? sub.customer : sub.customer.id;
}

function subscriptionExpiryIso(sub: Stripe.Subscription): string | null {
  const unixSeconds = sub.status === "trialing" && sub.trial_end
    ? sub.trial_end
    : sub.current_period_end;
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}

async function resolveTierId(sub: Stripe.Subscription): Promise<string> {
  const priceId = sub.items.data[0]?.price?.id;
  if (!priceId) throw new Error(`Subscription ${sub.id} has no price id`);

  // Preserve the proven production fallback: prefer Price metadata, then
  // Product metadata if the Price itself has no tier_id.
  const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
  let tierId = price.metadata?.tier_id;

  if (!tierId && price.product) {
    const product = typeof price.product === "string"
      ? await stripe.products.retrieve(price.product)
      : price.product;
    tierId = product?.metadata?.tier_id;
  }

  if (!tierId) {
    throw new Error(
      `Subscription ${sub.id}'s price (${priceId}) has no tier_id metadata on the price or product`,
    );
  }
  return tierId;
}

Deno.serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const uid = session.client_reference_id;
        const customerId = typeof session.customer === "string"
          ? session.customer
          : session.customer?.id;

        if (!uid) throw new Error(`Checkout session ${session.id} has no client_reference_id`);
        if (!customerId) throw new Error(`Checkout session ${session.id} has no Stripe customer`);

        await updateEntitlementByUserId(
          uid,
          { stripe_customer_id: customerId },
          `checkout.session.completed ${session.id}`,
        );
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = subscriptionCustomerId(sub);

        switch (sub.status) {
          case "active":
          case "trialing": {
            const tierId = await resolveTierId(sub);
            await updateEntitlementByCustomerId(
              customerId,
              {
                tier_id: tierId,
                tier_source: "stripe",
                tier_expires_at: subscriptionExpiryIso(sub),
              },
              `${event.type} ${sub.id} (${sub.status})`,
            );
            break;
          }

          case "past_due":
            // Do not immediately remove paid access while Stripe is retrying
            // payment. A later active/trialing event restores/refreshes state;
            // unpaid/canceled/deleted will remove access if recovery fails.
            break;

          case "paused":
            await updateEntitlementByCustomerId(
              customerId,
              { tier_id: "suspended", tier_source: "stripe", tier_expires_at: null },
              `${event.type} ${sub.id} (paused)`,
            );
            break;

          case "incomplete":
          case "incomplete_expired":
          case "unpaid":
          case "canceled":
            await updateEntitlementByCustomerId(
              customerId,
              { tier_id: "free", tier_source: "stripe", tier_expires_at: null },
              `${event.type} ${sub.id} (${sub.status})`,
            );
            break;

          default:
            console.warn(`Unhandled Stripe subscription status ${sub.status} for ${sub.id}`);
            break;
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = subscriptionCustomerId(sub);

        await updateEntitlementByCustomerId(
          customerId,
          { tier_id: "free", tier_source: "stripe", tier_expires_at: null },
          `customer.subscription.deleted ${sub.id}`,
        );
        break;
      }

      default:
        break;
    }
  } catch (err) {
    // Return non-2xx so Stripe retries transient failures instead of
    // permanently acknowledging an event AVEN failed to process.
    console.error("stripe-webhook handler error:", err);
    return new Response("Webhook handler failed", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
