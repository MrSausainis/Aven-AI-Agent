import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import Stripe from "npm:stripe@22.6.0";

const ORIGIN = "https://get-avenai.netlify.app";
const RETURN_URL = `${ORIGIN}/account?billing=return`;
const CONFIGURATION = "bpc_1ULRoQJ78TGxjoZzUbrnIpXH";
const headers = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2026-08-26.dahlia", timeout: 10000, maxNetworkRetries: 1,
});
function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && origin !== ORIGIN) return json({ error: "Origin not allowed" }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { ...headers, Allow: "POST, OPTIONS" } });
  const authorization = req.headers.get("Authorization") || "";
  if (!/^Bearer \S+$/i.test(authorization)) return json({ error: "Please sign in again." }, 401);
  try {
    const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await asUser.auth.getUser();
    if (authError || !authData?.user) return json({ error: "Please sign in again." }, 401);
    const user = authData.user;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: entitlement, error } = await admin.from("entitlements")
      .select("id,stripe_customer_id").eq("id", user.id).maybeSingle();
    if (error) return json({ error: "Billing details are temporarily unavailable." }, 503);
    if (!entitlement || entitlement.id !== user.id) return json({ error: "Billing account is unavailable." }, 409);
    const customerId = entitlement.stripe_customer_id;
    if (!customerId) return json({ error: "No Stripe billing account is linked yet. Free or manually granted plans do not need cancellation." }, 409);
    // Ignore every client body field: identity, customer, configuration and redirect are server-owned.
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted || (customer.metadata?.supabase_uid && customer.metadata.supabase_uid !== user.id)) {
      return json({ error: "Billing account requires support before it can be opened." }, 409);
    }
    const config = await stripe.billingPortal.configurations.retrieve(CONFIGURATION);
    if (!config.active || !config.livemode || !config.features.subscription_cancel.enabled ||
        config.features.subscription_cancel.mode !== "at_period_end" ||
        config.features.subscription_update.enabled || config.features.customer_update.enabled ||
        !config.features.payment_method_update.enabled || !config.features.invoice_history.enabled) {
      return json({ error: "Billing management is temporarily unavailable." }, 503);
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId, configuration: CONFIGURATION, return_url: RETURN_URL,
    }, { idempotencyKey: `portal:${user.id}:${customerId}:${CONFIGURATION}:${Math.floor(Date.now() / 30000)}` });
    const target = new URL(session.url);
    if (target.protocol !== "https:" || target.hostname !== "billing.stripe.com" || target.username || target.password || target.port) {
      throw new Error("Unexpected billing portal URL");
    }
    return json({ url: target.href });
  } catch {
    console.error("create-billing-portal: could not open billing management");
    return json({ error: "Could not open billing management. Try again in a moment." }, 503);
  }
});
