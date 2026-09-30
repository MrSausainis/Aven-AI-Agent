-- Migration version copied from Supabase history after successful application.
-- Service-only, SECURITY INVOKER RPCs.
ALTER TABLE public.entitlements ADD COLUMN stripe_subscription_id text;
ALTER TABLE public.entitlements ADD COLUMN stripe_subscription_status text;
CREATE UNIQUE INDEX entitlements_stripe_customer_unique ON public.entitlements(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE TABLE public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  customer_id text NOT NULL,
  event_created bigint NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.stripe_webhook_leases (
  customer_id text PRIMARY KEY,
  event_id text,
  lease_token uuid,
  expires_at timestamptz
);
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_webhook_events, public.stripe_webhook_leases FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_webhook_events, public.stripe_webhook_leases TO service_role;

CREATE FUNCTION public.claim_stripe_webhook(p_event_id text, p_customer_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE l public.stripe_webhook_leases%ROWTYPE; token uuid;
BEGIN
  IF p_event_id IS NULL OR p_customer_id IS NULL THEN RAISE EXCEPTION 'Missing Stripe identity'; END IF;
  INSERT INTO public.stripe_webhook_leases(customer_id) VALUES(p_customer_id) ON CONFLICT DO NOTHING;
  SELECT * INTO l FROM public.stripe_webhook_leases WHERE customer_id=p_customer_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.stripe_webhook_events WHERE event_id=p_event_id) THEN
    RETURN jsonb_build_object('state','duplicate');
  END IF;
  IF l.lease_token IS NOT NULL AND l.expires_at > clock_timestamp() THEN
    RETURN jsonb_build_object('state','busy');
  END IF;
  token := gen_random_uuid();
  UPDATE public.stripe_webhook_leases SET event_id=p_event_id, lease_token=token,
    expires_at=clock_timestamp()+interval '120 seconds' WHERE customer_id=p_customer_id;
  RETURN jsonb_build_object('state','claimed','token',token);
END; $$;

CREATE FUNCTION public.finish_stripe_webhook(
  p_event_id text, p_customer_id text, p_token uuid, p_event_type text, p_event_created bigint,
  p_user_id uuid, p_subscription_id text, p_subscription_status text,
  p_tier_id text, p_expires_at timestamptz
)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE l public.stripe_webhook_leases%ROWTYPE; affected integer;
BEGIN
  SELECT * INTO l FROM public.stripe_webhook_leases WHERE customer_id=p_customer_id FOR UPDATE;
  IF NOT FOUND OR l.lease_token IS DISTINCT FROM p_token OR p_token IS NULL
      OR l.event_id IS DISTINCT FROM p_event_id OR l.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'Stripe webhook lease lost or expired';
  END IF;
  IF p_tier_id IS NOT NULL AND p_tier_id NOT IN ('monthly','annual','suspended','free') THEN
    RAISE EXCEPTION 'Unsupported Stripe tier';
  END IF;
  -- Null tier means past_due: retain the previous access/grace policy.
  UPDATE public.entitlements SET
    stripe_customer_id=p_customer_id,
    stripe_subscription_id=p_subscription_id,
    stripe_subscription_status=p_subscription_status,
    tier_id=COALESCE(p_tier_id,tier_id),
    tier_source=CASE WHEN p_tier_id IS NULL THEN tier_source ELSE 'stripe' END,
    tier_expires_at=CASE WHEN p_tier_id IS NULL THEN tier_expires_at ELSE p_expires_at END,
    updated_at=clock_timestamp()
  WHERE (p_user_id IS NULL AND stripe_customer_id=p_customer_id)
     OR (p_user_id IS NOT NULL AND id=p_user_id AND (stripe_customer_id IS NULL OR stripe_customer_id=p_customer_id));
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Stripe customer must map to exactly one entitlement'; END IF;
  INSERT INTO public.stripe_webhook_events(event_id,event_type,customer_id,event_created)
    VALUES(p_event_id,p_event_type,p_customer_id,p_event_created);
  -- Entitlement, processed ID and release commit together or all roll back.
  UPDATE public.stripe_webhook_leases SET event_id=NULL,lease_token=NULL,expires_at=NULL WHERE customer_id=p_customer_id;
END; $$;

CREATE FUNCTION public.release_stripe_webhook(p_customer_id text,p_token uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  UPDATE public.stripe_webhook_leases SET event_id=NULL,lease_token=NULL,expires_at=NULL
    WHERE customer_id=p_customer_id AND lease_token=p_token;
$$;
REVOKE ALL ON FUNCTION public.claim_stripe_webhook(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_stripe_webhook(text,text,uuid,text,bigint,uuid,text,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.release_stripe_webhook(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_webhook(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_stripe_webhook(text,text,uuid,text,bigint,uuid,text,text,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_stripe_webhook(text,uuid) TO service_role;
