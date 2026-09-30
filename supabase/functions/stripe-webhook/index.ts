// Signed Stripe events trigger reconciliation, never apply stale event snapshots.
// JWT stays disabled ONLY because the raw-body Stripe signature authenticates it.
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import Stripe from "npm:stripe@22.6.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2026-08-26.dahlia",
  timeout: 8000,
  maxNetworkRetries: 1,
});
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const PRICE_TIERS: Record<string,string> = {
  price_1UCPzSJ78TGxjoZzD8Pc4ppZ: "monthly",
  price_1UD87kJ78TGxjoZzyIHNEkQG: "annual",
};
const HANDLED_EVENTS = new Set([
  "checkout.session.completed", "customer.subscription.created",
  "customer.subscription.updated", "customer.subscription.deleted",
]);
const MAX_WEBHOOK_BYTES = 256 * 1024;
const WEBHOOK_BODY_TIMEOUT_MS = 10000;

class PayloadError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

async function boundedBody(req: Request): Promise<string> {
  const length = req.headers.get("content-length");
  if (length !== null) {
    if (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length))) {
      throw new PayloadError("Invalid Content-Length", 400);
    }
    if (Number(length) > MAX_WEBHOOK_BYTES) throw new PayloadError("Payload too large", 413);
  }
  const encoding = req.headers.get("content-encoding");
  if (encoding && encoding.toLowerCase() !== "identity") {
    throw new PayloadError("Unsupported Content-Encoding", 415);
  }
  if (!req.body) throw new PayloadError("Missing webhook body", 400);
  const reader = req.body.getReader();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new PayloadError("Webhook body timed out", 408)), WEBHOOK_BODY_TIMEOUT_MS);
  });
  const bytes = new Uint8Array(MAX_WEBHOOK_BYTES);
  const deadline = Date.now() + WEBHOOK_BODY_TIMEOUT_MS;
  let total = 0;
  try {
    while (true) {
      if (Date.now() >= deadline) throw new PayloadError("Webhook body timed out", 408);
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      // Count actual bytes even with missing or dishonest Content-Length.
      if (total + value.byteLength > MAX_WEBHOOK_BYTES) throw new PayloadError("Payload too large", 413);
      bytes.set(value, total);
      total += value.byteLength;
    }
    // Preserve the signed UTF-8 text, including a BOM; no parse/reserialize step.
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, total));
  } catch (error) {
    // Do not await cancellation: an adversarial slow producer cannot delay rejection.
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    clearTimeout(timer!);
    try { reader.releaseLock(); } catch { /* Cancellation may still be settling. */ }
  }
}

function customerIdOf(value: string | { id: string } | null): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

function planItem(sub: Stripe.Subscription) {
  return sub.items.data.find(item => Object.hasOwn(PRICE_TIERS,item.price.id));
}

function expiryOf(sub: Stripe.Subscription): string {
  const seconds = sub.status === "trialing" && sub.trial_end
    ? sub.trial_end : planItem(sub)?.current_period_end;
  if (!seconds || !Number.isFinite(seconds)) throw new Error("Missing subscription period end");
  return new Date(seconds*1000).toISOString();
}

async function subscriptionsFor(customer: string): Promise<Stripe.Subscription[]> {
  const result: Stripe.Subscription[] = [];
  let cursor: string | undefined;
  for (let pageIndex=0; pageIndex<5; pageIndex++) {
    const page = await stripe.subscriptions.list({customer,status:"all",limit:100,...(cursor ? {starting_after:cursor} : {})});
    result.push(...page.data);
    if (!page.has_more) return result;
    cursor = page.data.at(-1)?.id;
    if (!cursor) throw new Error("Invalid subscription pagination");
  }
  // A partial subscription set cannot safely justify revoking access.
  throw new Error("Subscription reconciliation page limit exceeded");
}

function selectSubscription(subs: Stripe.Subscription[], preferredId: string | null): Stripe.Subscription | null {
  const supported = subs.filter(sub => planItem(sub));
  for (const states of [["active","trialing"],["past_due"],["paused"]]) {
    const group = supported.filter(sub => states.includes(sub.status));
    if (group.length) return group.find(sub => sub.id === preferredId)
      ?? group.sort((a,b) => b.created-a.created || a.id.localeCompare(b.id))[0];
  }
  return supported.sort((a,b) => b.created-a.created || a.id.localeCompare(b.id))[0] ?? null;
}

async function snapshotFor(customerId: string, preferredId: string | null) {
  const subs = await subscriptionsFor(customerId);
  const sub = selectSubscription(subs,preferredId);
  if (!sub) throw new Error("No supported subscription found; refusing ambiguous entitlement change");
  if (["active","trialing"].includes(sub.status)) {
    const item = planItem(sub)!;
    const expectedTier = PRICE_TIERS[item.price.id];
    const price = await stripe.prices.retrieve(item.price.id,{expand:["product"]});
    const product = typeof price.product === "string" ? await stripe.products.retrieve(price.product) : price.product;
    const metadataTier = price.metadata?.tier_id || (!product.deleted ? product.metadata?.tier_id : undefined);
    if (metadataTier !== expectedTier) throw new Error("Stripe price/product tier metadata mismatch");
    return {subscriptionId:sub.id,status:sub.status,tier:expectedTier,expiry:expiryOf(sub)};
  }
  if (sub.status === "past_due") return {subscriptionId:sub.id,status:sub.status,tier:null,expiry:null};
  if (sub.status === "paused") return {subscriptionId:sub.id,status:sub.status,tier:"suspended",expiry:null};
  if (["incomplete","incomplete_expired","unpaid","canceled"].includes(sub.status)) {
    return {subscriptionId:sub.id,status:sub.status,tier:"free",expiry:null};
  }
  throw new Error("Unhandled Stripe subscription status");
}

async function rpc(name: string, args: Record<string,unknown>) {
  const {data,error} = await supabaseAdmin.rpc(name,args);
  if (error) throw new Error(`Billing transaction failed: ${name}`);
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed",{status:405,headers:{Allow:"POST"}});
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing stripe-signature header",{status:400});
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await boundedBody(req),signature,webhookSecret);
  } catch (error) {
    if (error instanceof PayloadError) return new Response(error.message,{status:error.status});
    return new Response("Invalid signature",{status:400});
  }
  if (!HANDLED_EVENTS.has(event.type)) return new Response("Ignored",{status:200});
  const object = event.data.object as Stripe.Subscription | Stripe.Checkout.Session;
  if (event.type === "checkout.session.completed" && (object as Stripe.Checkout.Session).mode !== "subscription") {
    return new Response("Ignored non-subscription checkout",{status:200});
  }
  const customerId = customerIdOf(object.customer);
  if (!customerId) return new Response("Missing Stripe customer",{status:400});
  let token: string | null = null;
  try {
    const claim = await rpc("claim_stripe_webhook",{p_event_id:event.id,p_customer_id:customerId});
    if (claim.state === "duplicate") return new Response("Already processed",{status:200});
    if (claim.state === "busy") return new Response("Customer reconciliation busy",{status:503});
    if (claim.state !== "claimed" || !claim.token) throw new Error("Invalid billing lease");
    token = claim.token;
    const uid = event.type === "checkout.session.completed" ? (object as Stripe.Checkout.Session).client_reference_id : null;
    if (event.type === "checkout.session.completed" && !uid) throw new Error("Missing Checkout account reference");
    // Resolve by first-class customer ownership; never grant from user metadata.
    let lookup = supabaseAdmin.from("entitlements").select("id,stripe_customer_id,stripe_subscription_id");
    lookup = uid ? lookup.eq("id",uid) : lookup.eq("stripe_customer_id",customerId);
    const {data:row,error} = await lookup.maybeSingle();
    if (error || !row || (row.stripe_customer_id && row.stripe_customer_id !== customerId)) {
      throw new Error("Invalid Stripe customer/account mapping");
    }
    const snapshot = await snapshotFor(customerId,row.stripe_subscription_id);
    await rpc("finish_stripe_webhook",{
      p_event_id:event.id,p_customer_id:customerId,p_token:token,p_event_type:event.type,p_event_created:event.created,
      p_user_id:uid,p_subscription_id:snapshot.subscriptionId,p_subscription_status:snapshot.status,
      p_tier_id:snapshot.tier,p_expires_at:snapshot.expiry,
    });
    token = null;
    return new Response(JSON.stringify({received:true}),{status:200,headers:{"Content-Type":"application/json"}});
  } catch {
    // Do not acknowledge failures: Stripe retries; never log tokens/raw payloads.
    console.error("stripe-webhook reconciliation failed",event.id,event.type);
    return new Response("Webhook handler failed",{status:500});
  } finally {
    if (token) {
      try { await rpc("release_stripe_webhook",{p_customer_id:customerId,p_token:token}); }
      catch { /* A crash/error lease is recoverable after the bounded expiry. */ }
    }
  }
});
