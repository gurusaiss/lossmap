# LossMap: Progress (23 Oct 2026)

## Where we are
**Development is complete and tested locally. Nothing has been pushed, deployed or connected to a live service** (by instruction). The project was rebuilt on 23 Oct after the original sandbox was lost; the rebuild keeps the same design and is covered by the tests below. Connecting is configuration only: [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md).

## Built
| Area | Status |
|---|---|
| Schema, RLS on every table, composite organisation keys, server-side flags (GPS, clock, late sync, edited weight), immutable evidence, audit log, storage policies and daily photo cap | done, 38 SQL assertions |
| Loss logic (weight + quality ₹, cause rules, alert rules) in `packages/core` mirrored in SQL views | done; hand-calculated tests agree in TypeScript and SQL (₹150.40 + ₹792.00 = ₹942.40) |
| Field PWA: login, new lot, QR (lot id), in-app camera, GPS, AI scale reading + quality estimate with manual fallback, scan, timeline, Telugu/English, light/dark | done, 360 px browser tests |
| Offline: Dexie outbox (farmers, lots, checkpoints, photos), idempotent sync in dependency order, per-user queue, cached master data and lots, cold start with no connection (real service worker) | done, tested with a genuinely failing network and on the production build |
| Edge Functions: ai-read-scale, ai-quality, weather-exposure, check-alerts, telegram-webhook, insights-summary, demo-seed, public-photo, keepalive, staff | done, Deno type-checked; staff, org setup, demo seed, weather and sweep run against the real schema |
| Manager dashboard (managers only): KPIs, stage / centre / transporter / hour charts with tables, drill-down, map with list fallback, alerts, lots, lot detail with waterfall and rule text, weight correction (audited), weekly summary, settings (crops, centres, transporters, Telegram, demo, team) | done, desktop + phone + dark |
| Team and accounts, new-organisation script, disabled-login screen, demo login healing | done |
| Farmer lot report (public token) | done |
| Simulated demo scenario with one-click load/reset | done, story verified through the real views |
| CI, keep-alive, cron SQL, live smoke test, vercel.json | written |

## Test totals (all passing on 23 Oct 2026)
- 42 core + 11 web unit tests
- 38 SQL assertions on a clean Postgres 16 + 34 assertions running the real Edge Function code against that schema (Postgres-backed adapter stands in for PostgREST and the auth admin API)
- 39 browser tests (Chromium, 360 px phone and desktop): AI success/failure/edit, offline cycle, offline farmer, retry after failed upload, cold start offline with the real service worker, expired token offline, manager screens, team management, account and password change, disabled login, new-organisation setup, public report, WCAG 2.1 A/AA with axe (light and dark), 44 px tap targets
- ESLint, TypeScript, production build, Deno type-check of all functions

## Measured on the simulated demo data (before weather; computed by the real SQL views)
114 lots. Loss ₹46,053 of ₹5,73,192 farm-gate value (**8.03%**). Whole-lot percentages (headline, centres) use the lots' farm-gate value counted once per lot; stage, transporter and hour percentages use the value entering that step. Waiting at the centre ₹31,939 (5.7%), transport ₹10,534 (2.0%), farm to centre ₹3,580 (0.6%). Centre B **11.3%** (avg wait 3.4 h) vs Centre A **4.5%** (1.5 h). With a *synthetic* weather pattern in the server test, 35 waiting segments are tagged "heat during waiting". These are properties of generated data.

## NOT verified (needs your credentials: see GO_LIVE_CHECKLIST.md)
- Anything against a live Supabase project: real sign-in, PostgREST behaviour, Storage, Edge Function HTTP wrappers and JWT checks, `pg_cron` / `pg_net`, the Supabase auth admin calls behind team management. `scripts/smoke.mjs` checks these in one run; **it has never been run**.
- Gemini: model IDs, image + JSON schema support, rate limits and **accuracy** (no accuracy claim).
- Open-Meteo in production (rate limits from the shared function IP), Telegram delivery, Vercel hosting.
- Behaviour on real Android phones (camera, GPS, install, storage eviction).
- The Telugu wording was written by the developer, not by a native-speaking reviewer: have staff check it.

## Not built (roadmap)
Route-level analysis (we analyse by transporter), email invitations, farmer payment reports, quality certificates, lender/insurer data, WhatsApp bot, ERP / e-NAM links, accuracy study, field pilot, mandi price feed (data.gov.in was unreachable from the build environment).
