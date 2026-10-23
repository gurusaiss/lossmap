// Prints SQL that loads the generated demo scenario into a local test database (used by supabase/tests/run.sh).
import { DEMO_ORG_ID, generateDemoScenario } from '../packages/core/src/index.ts';
const s = generateDemoScenario({ now: new Date('2026-10-21T08:00:00Z'), ids: { orgId: DEMO_ORG_ID, managerId: '', agentId: '', receiverId: '' } });
const clean = JSON.parse(JSON.stringify(s, (_k, v) => (v === '' ? null : v)));
console.log(`select public.demo_load($lossmap$${JSON.stringify(clean)}$lossmap$::jsonb);`);
