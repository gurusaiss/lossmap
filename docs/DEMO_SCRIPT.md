# LossMap: Demo script (about 3 minutes)

Say "simulated" whenever a demo number is on screen. Use the manager login first, then the field agent on a phone.

**Before you start:** the demo is loaded (Settings → Load demo data, or `node scripts/seed-demo.mjs`); the app is open as `manager@demo.lossmap.app`; Telegram connected (optional); a phone with the agent login.

1. **0:00 The question (15 s).** "Produce from several villages arrives partly spoiled. Where was the loss?" Open the **Overview**: ₹ lost, "Simulated demo data" badge.
2. **0:15 Where (30 s).** Loss by stage: waiting at the centre is the biggest bar. Loss by centre: Centre B about 11% vs Centre A about 4.5%; average wait 3.4 h vs 1.5 h.
3. **0:45 When (20 s).** Loss by arrival hour: lots arriving after noon lose 11 to 14%, morning arrivals about 1%.
4. **1:05 Why (40 s).** Click the waiting bar → a lot → waterfall, the cause tag ("Heat during waiting") with the rule, hours and weather numbers.
5. **1:45 Act before it spoils (20 s).** Alerts page: "Lot … has waited 3.4 h … Dispatch now" (English and Telugu); Telegram message on the phone; Acknowledge.
6. **2:05 Capture (40 s)** on the phone as the agent: New lot → photograph the scale (AI reads the weight, worker confirms) → photograph the produce (visible quality estimate) → Save → QR label. Airplane mode: save a second checkpoint → "waiting to upload" → reconnect → it uploads.
7. **2:45 Close (15 s).** Farmer report link; toggle Telugu. "One scan and two photos at weighing points that already exist."

**If something fails:** AI slow → type the weight (that is the designed fallback); Telegram late → show the Alerts page; no network → use the screenshots in `docs/screenshots` (08, 10, 11, 03).
