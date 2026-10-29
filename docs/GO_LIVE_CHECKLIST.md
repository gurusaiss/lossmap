# LossMap: Go-live checklist (connect Supabase, Gemini, Telegram, hosting)

Everything below is configuration: no code changes are needed. Do these in order; each step says how to confirm it. Never commit secrets (`.env` files are git-ignored).

## 0. Before you start
- [ ] Nothing has been pushed anywhere. When you say "push", the code goes to a **public** GitHub repo (the submission requires it). Check `git status` first, and keep a zip copy.
- [ ] Free accounts: Supabase, Google AI Studio, Vercel (or Cloudflare Pages), Telegram (BotFather), GitHub.

## 1. Supabase project
1. Create a project (`lossmap`, region **Mumbai `ap-south-1`**, strong database password).
2. **Authentication → Providers → Email:** **Confirm email OFF**, **Allow new users to sign up OFF**.
3. Apply the migrations in order: `supabase login`, `supabase link --project-ref <ref>`, `supabase db push` (or paste `supabase/migrations/0001` … `0004` into the SQL editor in order). *Confirm:* tables exist and Storage has a private bucket `photos`.
4. **Database → Extensions:** enable `pg_cron` and `pg_net` (needed for the 15-minute sweep); otherwise use the GitHub Actions fallback in step 6.

## 2. Secrets for the Edge Functions
```bash
CRON_SECRET=$(openssl rand -hex 24); TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 24)
supabase secrets set GEMINI_API_KEY=... GEMINI_MODEL=... GEMINI_MODEL_FALLBACK=... AI_DAILY_LIMIT=400 AI_ORG_DAILY_LIMIT=150 \
  INSIGHTS_ORG_DAILY_LIMIT=20 WEATHER_ORG_DAILY_LIMIT=600 STAFF_ORG_DAILY_LIMIT=30 \
  TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=$TELEGRAM_WEBHOOK_SECRET CRON_SECRET=$CRON_SECRET
```
(`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.) **Gemini model:** in Google AI Studio create a key and pick a current Flash-class model with image input and JSON output on the free tier. **Confirm against the live model list**; model names change.

## 3. Deploy the functions
```bash
npm run sync:functions
supabase functions deploy ai-read-scale ai-quality weather-exposure check-alerts telegram-webhook insights-summary demo-seed public-photo keepalive staff
```
`supabase/config.toml` marks `check-alerts`, `telegram-webhook`, `public-photo`, `keepalive` and `insights-summary` as not requiring a user JWT (they check their own secret or the user inside).

## 4. Load the demo data
```bash
curl -X POST https://<ref>.supabase.co/functions/v1/demo-seed -H "Authorization: Bearer <SERVICE_ROLE_KEY>" -H "Content-Type: application/json" -d '{"action":"load"}'
```
Expected `{"ok":true,"lots":114,...}`; it fetches real weather and may take a minute (check `exposureUnavailable`). If it hits the free tier's 2 s CPU limit, run the same code from your machine: `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-demo.mjs load`. This also creates the three demo logins.

## 4b. A real customer organisation
There is no public sign-up. From your machine:
```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-org.mjs --name "Sri Tomato Processors" --type processor --manager-name "Anita Rao" --manager-email anita@example.com
```
It prints a temporary password once. The manager signs in, chooses their own (Account), adds crops, centres (including the factory) and staff in **Settings**. Keep real customers out of the shared demo project.

## 5. Smoke test (the real check)
```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... CRON_SECRET=... node scripts/smoke.mjs
```
**It has never been run against a live project.** Fix anything reported FAIL before going further.

## 6. Scheduler
Preferred: edit the URL and secret in `supabase/cron.sql` and run it once (15-minute sweep, daily keep-alive, weekly summary). Fallback without pg_cron: add GitHub secrets `SUPABASE_URL`, `CRON_SECRET` and the repository variable `USE_GH_CRON=true`. Always add the secrets for `keepalive.yml`. Check the project manually on 29, 30 and 31 Oct.

## 7. Telegram (optional)
@BotFather → `/newbot`; set the webhook: `curl "https://api.telegram.org/bot<TOKEN>/setWebhook" -d "url=https://<ref>.supabase.co/functions/v1/telegram-webhook" -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"`; set `VITE_TELEGRAM_BOT=<username>` for the frontend; in the app Settings → Connect Telegram → Start.

## 8. Frontend hosting (Vercel Hobby: non-commercial, fine for the hackathon)
Import the repo (root directory = repository root; `vercel.json` sets build, output `web/dist`, SPA rewrite, headers). Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TELEGRAM_BOT`. Open it on a real Android phone over HTTPS and install it. Put the URL in the README and the pitch.

## 9. Final acceptance (real phone and laptop, fresh incognito window)
- [ ] Manager login lands on the dashboard with the **Simulated demo data** badge; Centre B worse than Centre A; two open alerts; the map.
- [ ] Click a bar → segments → a lot → waterfall, cause tag with rule and weather numbers.
- [ ] Field agent: New lot with a real scale photo → weight pre-filled or "could not read" → QR → the lot appears on the dashboard.
- [ ] Airplane mode: save a checkpoint → waiting to upload → reconnect → it uploads.
- [ ] Telugu on both apps; have a Telugu speaker check the wording. Dark mode.
- [ ] Farmer report link opens without login and shows the simulated label.
- [ ] Real organisation: add a field agent in Settings → Team, sign in as them on a phone, change the temporary password in Account; disable them and confirm their phone shows "This login is not active".
- [ ] `node scripts/smoke.mjs` ends with ALL SMOKE CHECKS PASSED; CI is green.
- [ ] README live URL, `docs/JURY_QA.md` question 10 and `docs/PITCH_CONTENT.md` team/ask filled in. Optionally measure scale-reading accuracy on about 30 labelled photos and report it with its sample size.
- [ ] Before the 30 Oct presentation run `node scripts/seed-demo.mjs load` (resets the demo passwords too).

## 10. Submission (by the evening of 25 Oct)
Google Form: solution details, live URL with demo credentials, public GitHub repo, `docs/TECHNICAL_APPROACH.md`, `docs/screenshots`, the deck built from `docs/pitch`.

## Known risks while live
| Risk | What to do |
|---|---|
| Supabase pauses an idle project | keep-alive job; restore from the dashboard |
| Open-Meteo rate-limits the function IP | weather is cached per cell and day; failed lookups are retried; "unavailable" is shown, never invented |
| Gemini rate limit or model rename | the app falls back to typing; change `GEMINI_MODEL` (no code change) |
| Free-tier Gemini data use | only simulated data now; paid tier before real customer data |
| A visitor changes a demo password via the auth API | daily keep-alive resets it; run `seed-demo.mjs load` before presenting |
| Shared quotas | per-organisation daily caps on AI, weather, team changes and photo uploads; host the demo in its own project if real customers share it |
