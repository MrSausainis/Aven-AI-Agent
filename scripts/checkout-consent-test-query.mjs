import { readFileSync } from 'node:fs';
const proposal = readFileSync(new URL('../supabase/proposals/checkout-consent.sql', import.meta.url), 'utf8');
const tests = readFileSync(new URL('../supabase/tests/checkout-consent.sql', import.meta.url), 'utf8');
process.stdout.write('BEGIN;\n' + proposal + '\n' + tests + '\nROLLBACK;\n');
