# Cloudflare live v130 all-bot calibration batch, Nov 6 2026

Exact deployed Worker source retrieved from Cloudflare `/content/v2` and `worker-cloud-only.js` executed in an isolated in-memory JavaScript harness. Original X1 bot logic, no bid limits or rule changes. Four real bot seats in engine harness: ISA, Crow, Anchor, Jerome; deterministic PRNG, 16 fresh deals, rotating dealers. Not hosted HTTP/browser acceptance.

**16/16 completed, 1 set, 0 X1 fallbacks, 0 final winning bids above X1 own-hand `ceiling()` heuristic.** Failed deal: Jerome bid 135, secured 130, own-hand heuristic threshold 135. This reinforces that `ceiling()` is a threshold, not a calibrated make probability.

Cumulative prior unpaired baseline: 96 completed hands (original 36, subsequent 12 and 20, then 16 all-bot and 12 heuristic calibration). With this batch: **112 unpaired baseline hands and 38 sets**. Separately tested 16 original-deal paired experiment baselines and candidate replays are excluded from these totals.

**Owner directive:** no artificial bid caps. Investigate make-probability calibration, nest/discard evaluation, trump selection and actual play. All changes remain isolated; no live deployment.
