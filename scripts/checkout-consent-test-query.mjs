import { readFileSync } from 'node:fs';
const files = [
  '../supabase/proposals/purchase-legal-release.sql',
  '../supabase/proposals/checkout-consent.sql',
  '../supabase/proposals/purchase-confirmations.sql',
  '../supabase/tests/checkout-consent.sql',
  '../supabase/tests/purchase-confirmations.sql',
];
process.stdout.write('BEGIN;\n'+files.map(file=>readFileSync(new URL(file,import.meta.url),'utf8')).join('\n')+'\nROLLBACK;\n');
