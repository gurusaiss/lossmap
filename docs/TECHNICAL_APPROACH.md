# LossMap: Technical approach

## 1. Architecture
Offline-first React PWA → Supabase (Postgres with row-level security, Storage, Edge Functions on Deno) → AI (Gemini), weather (Open-Meteo), alerts (Telegram). The loss figures are computed in **SQL views**; TypeScript in `packages/core` mirrors the formulas for tests and text. Edge Functions use a vendored copy of `packages/core` (`npm run sync:functions`; CI fails on drift).

## 2. Data model
Organisations, profiles (role, `disabled`), farmers, crops (price, damaged-value factor, heat threshold, safe wait, scale tolerance), centres, transporters, lots (public token), checkpoints (weight, AI weight, quality, photos, GPS, device and server time, flags), segment exposure, weather cache, AI cache and usage, alerts, insights, audit log. Every table has `org_id`; composite `(id, org_id)` foreign keys make cross-organisation references impossible.

## 3. Loss logic (transparent, unit-tested)
- Quality factor `q = (good + d × damaged) / 100`, `d` per crop.
- Weight loss ₹ = max(0, w_prev − w_curr) × price × q_prev. Quality loss ₹ = max(0, q_prev − q_curr) × w_curr × price. A weight gain is "variance", never negative loss; differences within the crop's tolerance are noise.
- Cause rules (first match wins, decided by the SQL view): within tolerance; **R1** waited longer than the safe wait with at least one hour above the heat threshold; **R2** waited too long; **R3** transport slower than 1.25 × expected; **R4** visible quality fell 5 or more points while handling; else unexplained. The screen shows the rule and its numbers.
- Alerts: warn at 75% of the safe wait, critical at 100%; one alert per severity per wait (dedupe key includes the arrival time); Telegram delivery is retried for 24 hours.
- Percentages: whole-lot figures (headline, centres) divide by the farm-gate value counted once per lot; stage, transporter and hour figures divide by the value entering that step.
- **Verification:** the 5 h waiting segment (248 kg at 90/8 → 240 kg at 65/25) is ₹150.40 + ₹792.00 = ₹942.40 in the TypeScript tests and in the SQL view.

## 4. AI (Gemini, structured output)
Edge Functions call the REST API with a JSON schema. Output is untrusted: parsed, clamped, normalised to 100%; low confidence or odd units mean "type the weight". Photo-hash cache, global and per-organisation daily budgets (fail closed), primary then fallback model, all failures answer `200 {ok:false, reason}` so AI never blocks. The AI reading, its confidence and the confirmed value are stored side by side (accuracy can be measured later; none is claimed). The weekly summary is a deterministic template; optional AI rewording is accepted only if it contains no number that was not given to it.

## 5. Trust and anti-tampering
In-app camera only (other sources flagged `file_input`); the **server** stamps its own time and computes flags (GPS far from the centre, no GPS, device clock ahead, synced more than 72 h late, weight edited); evidence columns are immutable; manager weight corrections go to an audit log; fixed checkpoints do not depend on the driver's phone. Limit: a colluding insider can photograph a false number; it is made visible, not impossible.

## 6. Offline
Dexie outbox with client-generated UUIDs: re-sending is an idempotent upsert (at-least-once delivery, exactly-once effect). Order: farmers, lots, then checkpoints with photos first. A dropped connection stops the run and keeps everything queued; a server rejection marks only that item. Items belong to the person who captured them and upload only under their session; caches are wiped on sign-out or user change. QR labels carry the lot id (a UUID). The app opens from a cold start with no connection (service worker plus remembered identity, also with an expired token). Sync runs on app open, on `online`, on return to the app, and every 30 s while items wait.

## 7. Security
- Row-level security on every table; `auth_org()` / `auth_role()` return nothing for a disabled person, so access ends at once. Loss analytics are visible to managers only (`can_see_analytics()`); the service role used by scheduled jobs is allowed and always filters by organisation.
- Column-level grants: `organizations.telegram_chat_id` and the link token are not readable from the browser; lots can only change `status`.
- Private photo bucket, per-organisation folders, signed URLs, 2,000 uploads per organisation per day.
- Cron endpoints use a constant-time secret check; the Telegram webhook checks Telegram's secret token; demo seeding is limited to the service role or a manager of the demo organisation.
- Team management (`staff` function): manager only, never in the demo organisation, targets looked up inside the caller's organisation, per-organisation daily limit, random 12-character temporary passwords shown once and not stored, the last active manager cannot be disabled.
- Dependencies are pinned exactly, none newer than 14 days when chosen.

## 8. Free-tier strategy
Supabase (500 MB database, 1 GB storage), Gemini free key, Open-Meteo (one call per 0.1° cell and day, cached), Telegram, OpenFreeMap, Vercel Hobby. Photos are compressed to about 200 KB. Pilot running cost: ₹0. Paid path: Supabase Pro, paid Gemini or another provider (needed for customer-data privacy), Open-Meteo commercial plan.

## 9. Scaling path
New crops are rows in `crops`. Multi-tenant from day one. A materialised summary is the next step if an organisation grows far beyond pilot size (thousands of lots); the views have not been load-tested on Supabase.

## 10. Quality gates
Lint, type-check, 42 core + 11 web unit tests, 38 SQL assertions, 34 server-code assertions against the real schema, Deno type-check of all Edge Functions, production build, `npm audit`, 39 browser tests (360 px phone and desktop, real service worker offline, WCAG 2.1 A/AA with axe, 44 px tap targets). `scripts/smoke.mjs` covers the live services once connected; it has not been run.
