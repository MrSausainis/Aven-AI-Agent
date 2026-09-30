// Emergency rollback for a newly introduced endpoint. Deploy with verify_jwt=true.
Deno.serve(() => new Response(JSON.stringify({ error: "Billing management is temporarily unavailable." }), {
  status: 503,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "https://get-avenai.netlify.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  },
}));
