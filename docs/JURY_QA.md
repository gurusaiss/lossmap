# LossMap: Jury Q&A

Short answers first. Items in **[ ]** must be filled in by the team with real facts. Where a claim depends on something not yet measured, the answer says so.

## 1. "Solutions already exist (TraceX, Intello Labs, FarmERP). What's unique?"
**Short:** they track origin or grade quality; LossMap diagnoses **where, when and why value was lost, in rupees**, and warns before it happens. We describe others from public positioning only. **[Verify each named competitor before presenting.]**
- Traceability records where produce came from; grading scores quality at one point. LossMap compares consecutive weighing points and attributes a probable cause from waiting time and heat (rule shown with its numbers).
- It adds no hardware and no staff; it prevents loss with live "dispatch now" alerts; it is built for small and mid-size processors and FPOs (Telugu, offline, low-end Android, near-zero cost).

## 2. "Who will buy? What's the business model?"
Tomato and mango processors, exporters, aggregators and large FPOs in Andhra Pradesh. **Proposed, not validated:** free 30-day pilot for one centre; per-centre monthly plans; enterprise pricing; later add-ons. Demand evidence we can cite is the NABCONS 2022 study (₹1.53 lakh crore national loss; tomato 11.62%, 8.37% at the farm stage). **Real customer demand is not yet proven: [add interview findings, see question 10].** Illustrative ROI: on ₹10 crore procured, 1% less loss saves ₹10 lakh.

## 3. "There's already a person at the checkpoint. Why software?"
They weigh, but the number is not connected to the lot's history. LossMap adds one scan and two photos so every weight lands on one timeline. We have not timed this with real staff.

## 4. "What if staff or drivers cheat, or a phone is switched off?"
In-app camera only (other sources flagged); the **server** stamps its own time and computes flags (GPS far, no GPS, clock ahead, late sync, weight edited); photo evidence is immutable; manager corrections are audited; checkpoints are at fixed points, not on the driver's phone. A switched-off phone saves locally and uploads later. *Limit:* a colluding insider can photograph a false number; it becomes visible and costly, not impossible.

## 5. "How accurate is the AI? What if it's wrong?"
We have **not measured accuracy and make no claim**. The worker always confirms or edits; the AI reading, confidence and confirmed value are stored side by side so accuracy can be measured. Low confidence means "type the weight". Quality is a visible estimate, not a certified grade. If AI fails, typing is instant. **[Add a measured result with its sample size once done.]**

## 6. "Does it work without internet?"
Capture does: saved on the phone first, uploaded later, with a visible queue; cached lots can be scanned offline; the installed app opens from a cold start with no connection (tested with the real service worker). AI reading, weather and the dashboard need a connection.

## 7. "How does this help farmers?"
Each lot has a public report with the farm-gate weight, visible quality estimate and photo, evidence at handover; it also shows which step, not the farmer, lost the value. Future: fair-payment reports.

## 8. "How will it scale beyond the free tier and tomato?"
Crops are rows in a table (price, heat threshold, safe wait), not code; the schema is multi-tenant. Paid path: Supabase Pro, paid Gemini or another provider, Open-Meteo commercial plan, commercial hosting. The views have not been load-tested on Supabase.

## 9. "What does it cost to run?"
₹0 for the pilot on free tiers; photos are about 200 KB so 1 GB holds roughly 2,500 two-photo checkpoints. Per-centre cost at scale is not yet costed; the pilot will measure it.

## 10. "Have you talked to real users?"
**[To be filled in by the team with real interviews. Do not invent quotes.]**

| Who (role, place) | Date | What they said | What we changed or learned |
|---|---|---|---|
| *[Collection-centre staff]* | | | |
| *[Processor / aggregator manager]* | | | |
| *[FPO leader]* | | | |
| *[Farmer]* | | | |

## More questions to expect
- **Is the demo data real?** No. It is generated, labelled "Simulated demo data", and the organisation is flagged in the database. Do not present its figures as customer results.
- **How do you know the cause is heat during waiting?** We do not claim proof. A transparent rule fires when a lot waited longer than the crop's safe wait *and* the weather data shows at least one hour above the crop's heat threshold; the rule and numbers are shown.
- **Different scales?** A tolerance band treats small differences as noise; a weight gain is "variance", never negative loss. It remains a real-world limitation.
- **What if the weather API fails?** Failures are retried and never stored as data; if there is no data the segment shows "weather unavailable" and causes use waiting time only.
- **How do customers get accounts?** No public sign-up: the project owner creates the organisation and first manager; the manager adds staff with one-time temporary passwords; disabled people lose access immediately.
- **Who can see what?** Each organisation sees only its own data (row-level security); inside it, loss analytics are for managers only; photos are private behind signed links; the farmer report exposes one lot through an unguessable link.
- **Data and privacy?** Free-tier Gemini may use inputs to improve Google products, so real customer data moves to the paid tier (or another provider) with a consent line before any pilot.
