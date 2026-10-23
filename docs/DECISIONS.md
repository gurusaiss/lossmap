# LossMap: Decisions log

| Topic | Decision | Why |
|---|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind 4 PWA, react-i18next (EN/TE) | fast installable mobile-first app |
| Backend | Supabase free tier (Postgres, Auth, Storage, Edge Functions, RLS, pg_cron) | one free stack for data, auth, files and server logic |
| Auth | Email + password; no public sign-up; demo users seeded; managers create staff | magic links are rate-limited on the free tier; real customers are created by the project owner |
| AI | Gemini via AI Studio key, model names only in env vars (`GEMINI_MODEL`, `GEMINI_MODEL_FALLBACK`) | model lists change; swappable provider |
| Weather | Open-Meteo forecast API with `past_days`, day-level cache, "unavailable" instead of invented values; transient failures retried, not stored | free hourly data; the archive API was unreliable |
| Maps | MapLibre + OpenFreeMap; list fallback if tiles fail | no key, no request limits |
| Charts | Recharts, each with a value table; colour never the only carrier of meaning | accessibility |
| QR | Encodes `/l/<lot id>` (UUID); short code typed as fallback | two lots can never share a label |
| Offline | Dexie outbox, client UUIDs, idempotent upserts, per-user queue | scattered villages, patchy signal |
| Loss percentages | Whole-lot = farm-gate value once per lot; step = value entering the step | re-counting value per segment understates the loss rate |
| Evidence | Server derives weight source and flags; evidence columns immutable; edits audited | the client is never trusted |
| Who sees analytics | Managers only (`can_see_analytics()`); service role for scheduled jobs | field staff do not need other people's performance |
| "Waiting now" | Counts arrivals against dispatches, not phone clocks | a wrong clock cannot hide or invent a waiting lot |
| Team accounts | `staff` Edge Function; temporary password shown once; disabling = profile flag (instant, via RLS) + login ban; cannot disable self or the last manager; not in the demo org | no email service needed; works on the free tier |
| Demo password | Public; daily keep-alive resets the three demo logins; the app hides password change for demo accounts | hiding a form is not a lock |
| Real customers | `scripts/create-org.mjs` (service role) creates the organisation and first manager | start a pilot without opening sign-up |
| Demo data | Deterministic generator; loaded by `demo_load()` with seeding bypass of server flags; real weather attached afterwards | reproducible story, clearly labelled simulated |
| Mandi prices | **Not built**; price is a manual, editable estimate | data.gov.in was unreachable from the build environment, so it could not be checked; a wrong price distorts every ₹ figure |
| Dependencies | Exact versions, none newer than 14 days; `legacy-peer-deps` (vitest optional peers) plus explicit `react-is` for Recharts | supply-chain caution |
| Playwright | Pinned to the version whose browsers are installed (1.56.1) | no browser downloads in the sandbox |
| Rebuild note | The project was rebuilt on 23 Oct after the sandbox was lost; figures were re-measured and docs updated | earlier deck figures (11.7% vs 3.9%) were replaced by 11.3% vs 4.5% |
