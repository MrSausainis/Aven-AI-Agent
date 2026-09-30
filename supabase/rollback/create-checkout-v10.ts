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

import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import Stripe from "npm:stripe@22.6.0";

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
  apiVersion: "2026-08-26.dahlia",
  timeout: 20000,
  maxNetworkRetries: 1,
});

class CheckoutError extends Error {
  status: number;
  constructor(message: string, status = 409) { super(message); this.status = status; }
}

type Attempt = {
  id: string;
  startedAt: number;
  plan: PlanId;
  customerParams: Stripe.CustomerCreateParams;
  sessionParams?: Stripe.Checkout.SessionCreateParams;
  sessionId?: string;
};

// Bound every scan. Incomplete Stripe reads must never authorize a new checkout.
async function listAll<T extends { id: string }>(fetchPage: (cursor?: string) => Promise<{ data: T[]; has_more: boolean }>) {
  const rows: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 5; page++) {
    const result = await fetchPage(cursor);
    rows.push(...result.data);
    if (!result.has_more) return rows;
    if (!result.data.length) break;
    cursor = result.data[result.data.length - 1].id;
  }
  throw new CheckoutError("Could not verify existing billing state. Try again later.", 503);
}

function assertOwner(session: Stripe.Checkout.Session, customerId: string, userId: string) {
  const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (customer !== customerId || session.client_reference_id !== userId || session.mode !== "subscription") {
    throw new CheckoutError("Existing checkout requires billing support.");
  }
}

function assertRetryWindow(attempt: Attempt) {
  // Stripe can prune idempotency keys after 24h. Never repeat an ambiguous
  // create outside a conservative window; a lost response requires recovery.
  if (!Number.isFinite(attempt.startedAt) || Date.now() - attempt.startedAt >= 23 * 3600000) {
    throw new CheckoutError("An earlier checkout needs billing support before retrying.");
  }
}

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

  let admin: ReturnType<typeof createClient> | undefined;
  let ownerId: string | undefined;
  let token: string | undefined;
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ error: "Invalid checkout body" }, 400);
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
    admin = supabaseAdmin;
    ownerId = user.id;
    const { data: claim, error: claimError } = await admin.rpc("claim_checkout", { p_user_id: user.id });
    if (claimError || !claim) throw new Error("Checkout claim failed");
    if (claim.state === "busy") return jsonResponse({ error: "Checkout is already being prepared. Try again in a moment." }, 409);
    if (claim.state !== "claimed" || !claim.token) throw new Error("Invalid checkout claim");
    token = claim.token;
    let attempt: Attempt | null = claim.attempt?.id ? claim.attempt : null;
    const save = async (next: Attempt | null, customerId: string | null = null) => {
      const { error } = await supabaseAdmin.rpc("save_checkout_attempt", {
        p_user_id: user.id, p_token: token, p_attempt: next ?? {}, p_customer_id: customerId,
      });
      if (error) throw new Error("Checkout snapshot commit failed");
      attempt = next;
    };

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

    let customerId: string | null = entitlement.stripe_customer_id;
    let open: Stripe.Checkout.Session[] = [];
    if (customerId) {
      const subscriptions = await listAll<Stripe.Subscription>((cursor) => stripe.subscriptions.list({
        customer: customerId!, status: "all", limit: 100, ...(cursor ? { starting_after: cursor } : {}),
      }));
      if (subscriptions.some((s) => !["canceled", "incomplete_expired"].includes(s.status))) {
        throw new CheckoutError("A subscription already exists. Manage it instead of starting another.");
      }
      open = (await listAll<Stripe.Checkout.Session>((cursor) => stripe.checkout.sessions.list({
        customer: customerId!, status: "open", limit: 100, ...(cursor ? { starting_after: cursor } : {}),
      }))).filter((s) => s.mode === "subscription");
      if (open.length > 1) throw new CheckoutError("Multiple existing checkouts require billing support.");
      for (const session of open) assertOwner(session, customerId, user.id);
    }

    // Adopt a single pre-migration open checkout, or recover a response lost
    // after Stripe created our session but before its ID was committed.
    if (open.length) {
      const session = open[0];
      if (attempt && session.id !== attempt.sessionId && session.metadata?.checkout_attempt !== attempt.id) {
        throw new CheckoutError("Another unfinished checkout requires billing support.");
      }
      if (!attempt) {
        const lines = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 });
        const previousPlan = lines.data.length === 1 && !lines.has_more && lines.data[0].quantity === 1
          ? PRICE_TO_PLAN.get(lines.data[0].price?.id ?? "") : null;
        if (!previousPlan) throw new CheckoutError("Existing checkout uses an unsupported plan.");
        await save({ id: crypto.randomUUID(), startedAt: Date.now(), plan: previousPlan, customerParams: {}, sessionId: session.id });
      } else if (!attempt.sessionId) {
        await save({ ...attempt, sessionId: session.id });
      }
    }

    if (attempt?.sessionId) {
      let session = await stripe.checkout.sessions.retrieve(attempt.sessionId);
      assertOwner(session, customerId!, user.id);
      if (session.status === "complete") {
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (!subscriptionId) throw new CheckoutError("Previous checkout is still being processed.");
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const customer = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
        if (customer !== customerId || !["canceled", "incomplete_expired"].includes(subscription.status)) {
          throw new CheckoutError("Previous checkout is complete. Manage the existing subscription.");
        }
      } else if (session.status === "open") {
        if (attempt.plan === plan) {
          if (!session.url) throw new CheckoutError("Checkout is temporarily unavailable.", 502);
          return jsonResponse({ url: session.url });
        }
        // Renew/fence ownership before the external mutation. Stripe expiration
        // wins or completion wins; never start the replacement on ambiguity.
        await save(attempt);
        session = await stripe.checkout.sessions.expire(session.id);
        if (session.status !== "expired") throw new CheckoutError("Previous checkout could not be closed.");
      } else if (session.status !== "expired") {
        throw new CheckoutError("Previous checkout status is unavailable.", 503);
      }
      await save(null);
    }

    if (!attempt) {
      await save({ id: crypto.randomUUID(), startedAt: Date.now(), plan,
        customerParams: { ...(user.email ? { email: user.email } : {}), metadata: { supabase_uid: user.id } },
      });
    }
    // An unresolved old-plan create must be recovered with its original exact
    // parameters, never with the newly clicked plan's parameters.
    assertRetryWindow(attempt!);
    if (!customerId) {
      await save(attempt);
      const customer = await stripe.customers.create(attempt!.customerParams, {
        idempotencyKey: `jysen-customer-${attempt!.id}`,
      });
      customerId = customer.id;
      await save(attempt, customerId);
    }
    if (!attempt!.sessionParams) {
      const original = PLANS[attempt!.plan];
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription", customer: customerId, client_reference_id: user.id,
        line_items: [{ price: original.priceId, quantity: 1 }],
        success_url: `${ACCOUNT_PAGE_URL}?checkout=success`, cancel_url: `${ACCOUNT_PAGE_URL}?checkout=cancelled`,
        metadata: { aven_plan: attempt!.plan, supabase_uid: user.id, checkout_attempt: attempt!.id },
        integration_identifier: `jysen-checkout-${Array.from(crypto.getRandomValues(new Uint8Array(8)), (n) => String.fromCharCode(97 + n % 26)).join("")}`,
        // Existing production workaround: Managed Payments requires tax codes.
        managed_payments: { enabled: false },
      };
      await save({ ...attempt!, sessionParams });
    }
    if (attempt!.sessionParams!.customer !== customerId) throw new Error("Checkout customer changed");
    await save(attempt);
    const createdSession = await stripe.checkout.sessions.create(attempt!.sessionParams!, {
      idempotencyKey: `jysen-checkout-${attempt!.id}`,
    });
    assertOwner(createdSession, customerId!, user.id);
    await save({ ...attempt!, sessionId: createdSession.id });
    const session = await stripe.checkout.sessions.retrieve(createdSession.id);
    assertOwner(session, customerId!, user.id);
    // A recovered create may return a historical complete/expired snapshot.
    // Retrieve on the next request rather than return an obsolete cached URL.
    if (attempt!.plan !== plan || session.status !== "open" || !session.url) {
      throw new CheckoutError("Earlier checkout recovered. Retry to continue with the selected plan.");
    }
    return jsonResponse({ url: session.url });
  } catch (err) {
    if (err instanceof CheckoutError) return jsonResponse({ error: err.message }, err.status);
    console.error("create-checkout: billing preparation failed");
    return jsonResponse({ error: "Could not start checkout" }, 500);
  } finally {
    if (admin && ownerId && token) {
      const { error } = await admin.rpc("release_checkout", { p_user_id: ownerId, p_token: token });
      if (error) console.error("create-checkout: lease release failed; bounded expiry will recover it");
    }
  }
});
