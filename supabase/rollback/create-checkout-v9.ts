// ============================================================================
// create-checkout - Supabase Edge Function
// Phase 2B checkout hardening
//
// Compatibility:
// - existing website clients may continue sending { price_id }
// - future clients may send { plan: "monthly" | "annual" }
//
// Security:
// - only the two production AVEN prices are accepted server-side
// - Stripe price/product state and tier metadata are revalidated server-side
// - caller identity comes only from the verified Supabase JWT
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.0.0";

const ACCOUNT_PAGE_URL = "https://get-avenai.netlify.app/account";
const WEBSITE_ORIGIN = "https://get-avenai.netlify.app";

const PLANS = {
  monthly: {
    priceId: "price_1UCPzSJ78TGxjoZzD8Pc4ppZ",
    tierId: "monthly",
  },
  annual: {
    priceId: "price_1UD87kJ78TGxjoZzyIHNEkQG",
    tierId: "annual",
  },
} as const;

type PlanId = keyof typeof PLANS;

const PRICE_TO_PLAN = new Map<string, PlanId>(
  Object.entries(PLANS).map(([plan, config]) => [config.priceId, plan as PlanId]),
);

const corsHeaders = {
  "Access-Control-Allow-Origin": WEBSITE_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(PLANS, value);
}

function resolveRequestedPlan(body: Record<string, unknown>): PlanId | null {
  const requestedPlan = body.plan;
  const requestedPrice = body.price_id;

  let planFromName: PlanId | null = null;
  let planFromPrice: PlanId | null = null;

  if (requestedPlan !== undefined) {
    if (!isPlanId(requestedPlan)) return null;
    planFromName = requestedPlan;
  }

  if (requestedPrice !== undefined) {
    if (typeof requestedPrice !== "string") return null;
    planFromPrice = PRICE_TO_PLAN.get(requestedPrice) ?? null;
    if (!planFromPrice) return null;
  }

  if (!planFromName && !planFromPrice) return null;
  if (planFromName && planFromPrice && planFromName !== planFromPrice) return null;

  return planFromName ?? planFromPrice;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const plan = resolveRequestedPlan(body);
    if (!plan) {
      return jsonResponse({ error: "Unknown or unsupported AVEN plan" }, 400);
    }

    const expected = PLANS[plan];

    // Verify the authenticated caller using their own Authorization header.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAsUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userError } = await supabaseAsUser.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Not authenticated" }, 401);
    }
    const user = userData.user;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Server-side price validation. Even if the client tampers with its body,
    // only the exact production AVEN price IDs above can reach this point.
    const price = await stripe.prices.retrieve(expected.priceId, { expand: ["product"] });
    if (!price.active || price.type !== "recurring" || !price.recurring) {
      console.error(`create-checkout: configured ${plan} price is not an active recurring price`);
      return jsonResponse({ error: "This plan is temporarily unavailable" }, 503);
    }

    let product: Stripe.Product | null = null;
    if (price.product && typeof price.product !== "string" && !price.product.deleted) {
      product = price.product;
    } else if (typeof price.product === "string") {
      const fetched = await stripe.products.retrieve(price.product);
      if (!fetched.deleted) product = fetched;
    }

    if (!product || !product.active) {
      console.error(`create-checkout: configured ${plan} product is missing or inactive`);
      return jsonResponse({ error: "This plan is temporarily unavailable" }, 503);
    }

    const metadataTier = price.metadata?.tier_id || product.metadata?.tier_id;
    if (metadataTier !== expected.tierId) {
      console.error(
        `create-checkout: configured ${plan} price/product tier metadata mismatch (got ${metadataTier ?? "missing"})`,
      );
      return jsonResponse({ error: "This plan is temporarily unavailable" }, 503);
    }

    const { data: entitlement, error: entitlementError } = await supabaseAdmin
      .from("entitlements")
      .select("stripe_customer_id,tier_id,tier_source")
      .eq("id", user.id)
      .maybeSingle();

    if (entitlementError || !entitlement) {
      console.error("create-checkout: failed to load entitlement row", entitlementError?.message);
      return jsonResponse({ error: "Could not prepare checkout" }, 500);
    }

    // Avoid accidentally creating multiple concurrent paid subscriptions.
    // Changing between monthly/annual should be handled later by a dedicated
    // subscription-management flow instead of creating a second subscription.
    if (
      entitlement.tier_source === "stripe" &&
      (entitlement.tier_id === "monthly" || entitlement.tier_id === "annual")
    ) {
      return jsonResponse(
        { error: "An active AVEN subscription already exists for this account" },
        409,
      );
    }

    let customerId: string | null | undefined = entitlement.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: user.email ?? undefined,
          metadata: { supabase_uid: user.id },
        },
        { idempotencyKey: `aven-customer-${user.id}` },
      );
      customerId = customer.id;

      const { data: updated, error: updateError } = await supabaseAdmin
        .from("entitlements")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id)
        .select("id");

      if (updateError || !updated || updated.length === 0) {
        console.error("create-checkout: failed to persist stripe_customer_id", updateError?.message);
        return jsonResponse({ error: "Could not prepare checkout" }, 500);
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: expected.priceId, quantity: 1 }],
      success_url: `${ACCOUNT_PAGE_URL}?checkout=success`,
      cancel_url: `${ACCOUNT_PAGE_URL}?checkout=cancelled`,
      metadata: {
        aven_plan: plan,
        supabase_uid: user.id,
      },
      // Preserve the production workaround already required by this Stripe
      // account. Without this, Checkout previously failed on missing product
      // tax-code requirements from Managed Payments.
      // @ts-ignore - supported by Stripe even if absent from this SDK's TS types.
      managed_payments: { enabled: false },
    });

    if (!session.url) {
      console.error(`create-checkout: Stripe session ${session.id} returned no URL`);
      return jsonResponse({ error: "Checkout is temporarily unavailable" }, 502);
    }

    return jsonResponse({ url: session.url });
  } catch (err) {
    console.error("create-checkout error:", err);
    return jsonResponse({ error: "Could not start checkout" }, 500);
  }
});
