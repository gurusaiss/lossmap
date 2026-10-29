// Loads (or resets) the simulated demo organisation from your own machine, running the SAME code as the demo-seed Edge Function.
// Use it if the function hits the free-tier 2 s CPU limit, or to seed without deploying functions first:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-demo.mjs [load|reset]
import { createClient } from '@supabase/supabase-js';
import { loadDemo, resetDemo } from '../supabase/functions/_shared/demoSeed.ts';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'); process.exit(2); }
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const action = process.argv[2] ?? 'load';
if (action === 'reset') { await resetDemo(db); console.log('demo data removed'); }
else if (action === 'load') console.log(await loadDemo(db));
else { console.error("action must be 'load' or 'reset'"); process.exit(2); }
