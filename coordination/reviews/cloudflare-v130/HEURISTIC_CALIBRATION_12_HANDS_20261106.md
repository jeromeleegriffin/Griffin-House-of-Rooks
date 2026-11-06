# Live Worker v130 heuristic calibration diagnostic — 12 completed all-bot hands

Date: November 6, 2026. Source: actual active Cloudflare Worker v130 downloaded through Cloudflare API and executed in memory with deterministic test randomness. No production changes.

Measured the final bidder's actual bid, the own-hand X1 core `ceiling()` *heuristic*, and the team's scored hand points after genuine X1 card play, discard, and trump selection. This heuristic is **a bidding threshold, not a promise or probability that the partnership can make a contract**.

| Bidder | Bid | Own-hand threshold | Actual captured | Set? |
|---|---:|---:|---:|---|
| Anchor | 100 | 120 | 135 | no |
| ISA | 100 | 100 | 185 | no |
| ISA | 115 | 135 | 150 | no |
| ISA | 125 | 135 | 100 | YES |
| Anchor | 120 | 130 | 200 | no |
| Anchor | 115 | 125 | 85 | YES |
| Crow | 115 | 120 | 155 | no |
| ISA | 115 | 120 | 115 | no |
| Jerome | 120 | 130 | 170 | no |
| Jerome | 115 | 125 | 200 | no |
| Crow | 100 | 120 | 175 | no |
| Jerome | 120 | 165 | 175 | no |

All 12 hands completed; 2 contracts set; 0 X1 fallbacks; zero successful bids exceeded the final bidder's heuristic threshold in this sample. The two failed bids were *below* the heuristic threshold (ISA 125 with threshold 135 and 100 captured; Anchor 115 with threshold 125 and 85 captured). Do NOT interpret this as evidence the AI is raising above its internal permitted threshold. Rather, the threshold does not predict how many counters the partnership will actually secure.

**Likely question**: Are the heuristic, auction continuation, nest and trump expectations calibrated against actual X1 played-hand distributions? The true test is paired deal replay and measuring predicted probability of making a contract versus outcomes, not imposing universal bid ceilings. Test separately in all-bot, single-player, and mixed-human hosted configurations.

No blind cap or limit should be introduced. User explicitly rejected global bid limits. These runs were in-memory engine tests, not hosted browser/UI acceptance.
