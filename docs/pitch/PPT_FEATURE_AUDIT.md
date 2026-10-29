# LossMap: feature audit for the pitch deck (23 Oct 2026)

Basis: this repository and its tests (42 core + 11 web unit, 38 SQL, 34 server-code, 39 browser). **Nothing is deployed or connected to live Supabase, Gemini, Telegram or Vercel, and nothing has been tried on a real phone.** "Working" means built and tested locally against the real database schema and a mocked backend in a real browser.

## Built and working (can be shown as "working MVP")
Field PWA (login, new lot, QR by lot id, in-app camera, GPS, scan, timeline, Telugu/English, light/dark); offline-first capture with queue and idempotent sync, cold start offline; AI scale reading and visible-quality estimate with manual fallback (code and error paths tested with fakes); heat exposure per segment (never invented); loss engine in SQL views mirrored by tested TypeScript, with cause rules and the rule shown; alerts (scheduled sweep, English/Telugu, Telegram delivery with retry, tested with a fake bot); manager dashboard (stage, centre, transporter, hour, drill-down, map, alerts, lot detail with waterfall, audited weight correction, settings); weekly summary (template, optional AI wording validated against given numbers); farmer report (public token); server-side anti-tamper flags and audit log; multi-tenant row-level security, manager-only analytics, per-organisation budgets; team management and account screens; real-organisation script; simulated demo organisation with load/reset.

Measured on the **simulated** data (before weather): 114 lots, ₹46,053 lost of ₹5,73,192 farm-gate value = 8.03%; Centre B 11.3% (avg wait 3.4 h) vs Centre A 4.5% (1.5 h), about 2.5x; waiting at the centre ₹31,939 is the biggest stage. Always say "simulated".

## Partly built (label it)
Every live service (code complete, not connected, so never say "live"); AI accuracy (stored for measurement, **not measured**); "about 10 seconds per checkpoint" (a design target, not timed with staff); heat tags in screenshots use a synthetic weather pattern; pricing and business model (proposed).

## Not built (roadmap only)
Route-level analysis (we analyse by transporter), field pilot and threshold calibration, email invitations, farmer payment reports, quality certificates, lender/insurer insights, WhatsApp bot, ERP / e-NAM integrations, mandi price feed, accuracy study, paid-tier migration.

## Facts for the deck
Live URL: none yet. Demo logins: manager@ / agent@ / receiver@demo.lossmap.app, password LossMap-Demo-2026. Stack: React 19 + TypeScript + Vite + Tailwind PWA (Dexie, react-i18next); Supabase (Postgres, Auth, Storage, Edge Functions, RLS, pg_cron); Gemini; Open-Meteo; Telegram; MapLibre + OpenFreeMap; Recharts; Vercel. Pilot running cost ₹0 on free tiers. Autonomous parts that exist: scheduled sweep (detect risk, bilingual alert, Telegram, retry), automatic weather enrichment, weekly summary: a scheduled pipeline, **not a multi-agent system**. Real user feedback: none. Screenshots: `docs/screenshots` 01 to 13.

## Corrections to the brief
"3 taps" is not measured: say "one scan, two photos". "By route" is not built: say stage, centre, transporter, time of day. Competitor features are unverified: neutral wording. The 100 kg to 82 kg story is an illustration.
