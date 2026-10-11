// Public offer data is frozen in the leased attempt. Credentials are never copied.
export function commerceConfig() {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('PURCHASE_CONFIRMATION_FROM');
  let trader;
  try { trader = JSON.parse(Deno.env.get('PURCHASE_TRADER_JSON') || 'null'); } catch {}
  if (!key || !from || !/^[^\r\n<>]+@[^\r\n<>]+\.[^\r\n<>]+$/.test(from) ||
      !trader || !['legal_name','geographic_address','country','support_email','telephone'].every(k => typeof trader[k]==='string' && trader[k].trim()) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trader.support_email)) throw new Error('Purchase confirmation configuration is incomplete');
  return { key, from, trader: Object.fromEntries(['legal_name','geographic_address','country','support_email','telephone','registration_id','vat_id'].filter(k=>typeof trader[k]==='string').map(k=>[k,trader[k]])) };
}

function base64Utf8(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function providePurchaseConfirmation(admin: any, stripe: any, subscriptionId: string, userId: string, customerId: string) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  // Legacy subscriptions remain reconcilable; no retroactive consent is invented.
  if (!sub.metadata?.checkout_consent) return;
  const pages: any[] = [];
  let cursor;
  for (let i=0;i<5;i++) {
    const page = await stripe.checkout.sessions.list({subscription:subscriptionId,limit:100,...(cursor?{starting_after:cursor}:{})});
    pages.push(...page.data);
    if (!page.has_more) break;
    if (i===4 || !page.data.length) throw new Error('Incomplete confirmation session scan');
    cursor=page.data.at(-1).id;
  }
  const candidates=pages.filter(s=>s.status==='complete' && s.payment_status==='paid' && s.metadata?.checkout_consent===sub.metadata.checkout_consent);
  if (candidates.length!==1) throw new Error('Paid purchase confirmation is not ready');
  const session=await stripe.checkout.sessions.retrieve(candidates[0].id);
  const sessionCustomer=typeof session.customer==='string'?session.customer:session.customer?.id;
  const sessionSubscription=typeof session.subscription==='string'?session.subscription:session.subscription?.id;
  if (session.status!=='complete' || session.payment_status!=='paid' || session.mode!=='subscription' || sessionCustomer!==customerId ||
      sessionSubscription!==subscriptionId || session.client_reference_id!==userId || session.metadata?.checkout_consent!==sub.metadata.checkout_consent ||
      session.metadata?.checkout_attempt!==sub.metadata.checkout_attempt || !Number.isSafeInteger(session.amount_total) || session.amount_total<0 ||
      !/^[a-z]{3}$/.test(session.currency)) throw new Error('Confirmation purchase ownership mismatch');
  const {data:consent,error:consentError}=await admin.from('checkout_consents').select('id,user_id,price_id')
    .eq('id',session.metadata.checkout_consent).eq('user_id',userId).maybeSingle();
  const lines=await stripe.checkout.sessions.listLineItems(session.id,{limit:2});
  if (consentError || !consent || lines.has_more || lines.data.length!==1 || lines.data[0].quantity!==1 ||
      lines.data[0].price?.id!==consent.price_id) throw new Error('Confirmation price does not match the original purchase');
  const rpc=async(name:string,args:any)=>{const {data,error}=await admin.rpc(name,args);if(error||!data)throw new Error('Purchase confirmation persistence failed');return data;};
  const receipt=await rpc('archive_purchase_confirmation',{
    p_user_id:userId,p_session_id:session.id,p_subscription_id:subscriptionId,p_customer_id:customerId,
    p_consent_id:session.metadata.checkout_consent,p_attempt_id:session.metadata.checkout_attempt,
    p_amount_total:session.amount_total,p_currency:session.currency,p_invoice_id:typeof session.invoice==='string'?session.invoice:session.invoice?.id||null,
  });
  if (receipt.provider_accepted_at) return;
  const delivery=await rpc('claim_purchase_confirmation_delivery',{p_confirmation_id:receipt.id});
  if (delivery.state==='accepted') return;
  if (delivery.state!=='claimed') throw new Error('Purchase confirmation delivery is pending or needs reconciliation');
  const config=commerceConfig();
  const payload=receipt.payload;
  const text=[
    'Purchase confirmation',
    'Reference: '+session.id,
    'Trader: '+payload.offer.trader.legal_name,
    'Address: '+payload.offer.trader.geographic_address+', '+payload.offer.trader.country,
    'Support / withdrawal requests: '+payload.offer.trader.support_email,
    'Telephone: '+payload.offer.trader.telephone,
    'Plan: '+payload.plan,
    'Paid: '+(payload.amount_total/100).toFixed(2)+' '+payload.currency.toUpperCase(),
    'Renewal: '+payload.offer.price.interval_count+' '+payload.offer.price.interval+'(s)',
    'Access: '+payload.offer.description,
    'Cancel renewal through Account > Manage billing. Cancellation keeps access through the paid period.',
    'Early-access request: '+payload.consent.request_text,
    'Rights acknowledgement: '+payload.consent.rights_notice,
    'Requested at: '+payload.consent.requested_at,
    'Policy: '+payload.consent.policy_version,
    'Legal release: '+payload.consent.legal_version,
    'Confirmation SHA-256: '+receipt.sha256,
    'Your applicable statutory withdrawal and refund rights remain preserved. This purchase request is not a withdrawal waiver.',
    'If a statutory withdrawal right applies, notify the private support email within the applicable period; cancellation of renewal is a separate request.',
    'Optional withdrawal notice: To '+payload.offer.trader.legal_name+' ('+payload.offer.trader.support_email+'): I wish to withdraw from the service contract [reference]. My name and address: [fill in]. Contract date: [fill in]. Notice date: [fill in]. Sign only if submitting on paper. Another clear withdrawal statement is also accepted.',
    'Keep the attached confirmation and exact Terms, Privacy and Refund documents for your records.',
  ].join('\n');
  const email={from:delivery.from_address,to:[receipt.recipient_email],subject:'AvenAI purchase confirmation '+session.id,text,
    attachments:[
      {filename:'purchase-confirmation.json',content:base64Utf8(receipt.payload_text)},
      {filename:'terms.html',content:base64Utf8(payload.documents.terms_html)},
      {filename:'privacy.html',content:base64Utf8(payload.documents.privacy_html)},
      {filename:'refunds.html',content:base64Utf8(payload.documents.refunds_html)},
    ]};
  // Persist sender with the first delivery claim; all ambiguous retries use the
  // same sender/body/key. The database refuses resends after a 23h safety window.
  const frozen=await rpc('freeze_purchase_confirmation_email',{p_confirmation_id:receipt.id,p_token:delivery.token,p_email:email});
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json','Idempotency-Key':'purchase-confirmation/'+receipt.id},body:JSON.stringify(frozen),signal:AbortSignal.timeout(8000)});
  if (!response.ok) throw new Error('Purchase confirmation provider unavailable');
  const result=await response.json();
  if (typeof result.id!=='string' || !result.id) throw new Error('Invalid confirmation provider acknowledgement');
  await rpc('accept_purchase_confirmation_delivery',{p_confirmation_id:receipt.id,p_token:delivery.token,p_provider_id:result.id});
}
