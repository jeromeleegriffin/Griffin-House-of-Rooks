# Live v130 human-partner bidding forecast audit: first five exact-deal trials

Date 2026-11-06. Verified active Cloudflare Worker version 4335d4fa-d2ef-4d1e-9bad-dda40e71ce1e (100%), retrieved `worker-cloud-only.js` through Cloudflare `content/v2`. In-memory execution of exact deployed functions. A **test-only instrumentation** added `diagnostics:result.evaluations` to the returned action object, exposing the existing `decidePartner` sampled utilities. No action semantics or live Worker changed.

Five 1-human/3-bot engine hands with the human seat controlled by `chooseTestBotAction`. Partner bot ISA occupies seat 2. Deterministic seed `0x768a11 + trial*35839 + 271`, rotating dealer. Five hands all complete; all ISA won final auctions.

| Trial | Final ISA bid | Bidding team points | Made? | ISA selected bid estimated sampled utility | Alternative pass utility | Difference |
|---|---:|---:|---|---:|---:|---:|
| 0 | 130 | 150 | yes | +3.5 | -51.6 | +55.2 |
| 1 | 115 | 100 | **set** | +62.5 | +21.7 | +40.8 |
| 2 | 130 | 75 | **set** | -48.6 | -105.6 | +57.0 |
| 3 | 135 | 55 | **set** | -173.0 | -182.9 | +9.9 |
| 4 | 115 | 200 | yes | +0.7 | -8.9 | +9.7 |

Notes:
- Listed estimates are **expected score-difference utility**, not projected points captured and **not** a make-probability. The bot may rationally choose a negative-valued bid if passing is even worse due to simulated opponent control, scoring and auction continuation.
- Trial 2: at high 105, ISA bid 130. Its sampled utility for passing was -105.6, for bidding 130 was -48.6; gain +57.0, estimated standard error 18.5. Realized 75 captured on 130 (set).
- Trial 3: at high 130, ISA bid 135. Passing utility -182.9, bidding utility -173.0; gain +9.9, SE 9.7. Realized 55 on 135 (set). **The choice is marginal** and was preferred by a small absolute forecast advantage.
- Trial 1: ISA bid 115 with positive estimated utility +62.5 vs passing +21.7, but captured 100 (set).
- These observations do not prove that individual bid values are illegal or above some calibrated strength. They show why tests must contrast auction utility predictions with actual card-play outcomes; simple ceiling changes would miss the underlying issue.
- The forecasts use simplified rollouts and sampled unseen opponent hands. Actual play uses X1 sampled action choices plus human partner logic. Need estimate probability of make and calibrate to true play policy.

## Combined role-specific evidence
The same active Worker v130 was used for separate 14 all-bot paired deals with X1 baseline vs Sol7 only on bidder team/defenders, and 10 mixed human/bot paired deals. Results saved in `ROLE_ISOLATION_24_DEALS_20261106.md`. The mixed test exercised 26 partner-aware bid decisions, with 5 baseline sets; X1/ Sol7 substitution is not a general fix.

Next: test confidence/calibration, specifically when partner-aware sampled pass utility is highly negative; verify each candidate against true hand make probability, multiple human competence policies, and replay full round scores and match outcomes. **No bid caps. No production changes.**
