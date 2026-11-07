# v130 corrected bidder forecast calibration: 14 measurable bid/pass cases, Nov 6 2026

**Source**: exact deployed Worker `griffin-house-of-rooks-online` version `4335d4fa-d2ef-4d1e-9bad-dda40e71ce1e`, read from Cloudflare `content/v2`. In-memory harness with **human bids and public suit voids observed just as the real Worker does** via `observeOnlineX1(room,before,result)`. No live state changes. Synthetic human seat 0 partnered with ISA seat 2. Test-only instrumentation exposes original `decidePartner()` candidate `value`, `gain`, `se` without changing action selection.

## Same-seed comparison
On 16 dealt scenarios (trial ranges 30–37 and 46–53), compare:
- Original live X1 partner-bidding decision and complete actual play.
- Force the **first positive ISA bid** to pass; continue the real auction and card play, including all-pass redeal as a zero *current-hand* score change.

For 14 scenarios with a positive ISA bid and captured forecast, compare predicted **score difference advantage of chosen bid over passing** vs realized `original Team A score difference - counterfactual pass Team A score difference`. These are not direct estimates of number of counters captured or exact match-win probability.

| Trial | ISA first offered | Forecasted advantage | Forecast SE | Actual gain from original bid over forced pass |
|---|---:|---:|---:|---:|
| 30 | 120 | +41.3 | 12.7 | +260 |
| 32 | 115 | +87.1 | 10.1 | 0 |
| 33 | 105 | +6.4 | 6.0 | **-410** |
| 34 | 125 | +5.7 | 4.5 | +150 |
| 35 | 125 | +33.3 | 14.7 | **-60** |
| 36 | 120 | +42.6 | 13.4 | **-100** |
| 37 | 100 | +15.2 | 6.7 | +10 |
| 46 | 125 | +29.6 | 21.2 | +305 |
| 47 | 100 | +63.1 | 8.0 | +170 |
| 49 | 115 | +12.1 | 9.6 | +60 |
| 50 | 110 | +10.0 | 7.0 | +50 |
| 51 | 100 | +30.2 | 8.1 | +100 |
| 52 | 115 | +49.9 | 9.6 | 0 |
| 53 | 100 | +4.8 | 3.4 | +80 |

Across 14 measurable decisions, **9 improved actual score**, **3 worsened it** and **2 had zero observed difference**. All 14 chosen offers had positive predicted utility gains versus passing (expected because the algorithm selected them). The three wrong-sign examples include trial 33 predicted +6.4 but actual -410, trial 35 predicted +33.3 but actual -60, and trial 36 predicted +42.6 but actual -100.

**Important limitations**: The predicted numbers are expected value differences over sampled *different hypothetical continuation auctions*, not perfect estimates of the deterministic exact-deal counterfactual outcome. There is outcome variance and the suite is small; do not infer a coding error just from a sign disagreement. The observer fix is a test-harness correction. The simulated human is simplistic; real hosted multiplayer & browser single-player have not been certified.

## Stronger paired evidence
Separate corrected same-seed suite `CORRECTED_78_PAIRED_MULTIMODE_20261106.md`: 78 pairs = 156 scenario executions across one, two and three scripted human seats. Forced first bot pass improved team differential on 19 pairs, worsened on 35, tied on 24; total harm **-3170** team-relative score across all modes. Includes five all-pass redeals. This argues against blind passing, not against fixing genuine forecast bias.

## Follow-up
Evaluate forecast calibration on a much larger set of **out-of-sample held-out deals**, with real teammate quality variation and a conditional make-probability distribution. Do not impose bid limits, replace X1 wholesale, or publish unverified changes.
