// Creates a real (non-demo) organisation and its first manager. Needs the service-role key, so run it on your own machine:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-org.mjs --name "Sri Tomato Processors" --type processor --manager-name "Anita Rao" --manager-email anita@example.com
// Prints a temporary password once. Types: processor, fpo, aggregator, exporter.
import { createClient } from '@supabase/supabase-js';
import { createOrganization } from '../supabase/functions/_shared/orgSetup.ts';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'); process.exit(2); }
const args = Object.fromEntries(process.argv.slice(2).flatMap((a, i, all) => (a.startsWith('--') ? [[a.slice(2), all[i + 1]]] : [])));
if (!args.name || !args['manager-name'] || !args['manager-email']) { console.error('Usage: node scripts/create-org.mjs --name <organisation> [--type processor|fpo|aggregator|exporter] --manager-name <name> --manager-email <email>'); process.exit(2); }
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const r = await createOrganization(db, { orgName: args.name, orgType: args.type ?? 'processor', managerName: args['manager-name'], managerEmail: args['manager-email'] });
if (!r.ok) { console.error(`Failed (${r.code}): ${r.error}`); process.exit(1); }
console.log(`Organisation created: ${args.name} (${r.orgId})\nManager login: ${args['manager-email'].trim().toLowerCase()}\nTemporary password (shown only now): ${r.tempPassword}`);
