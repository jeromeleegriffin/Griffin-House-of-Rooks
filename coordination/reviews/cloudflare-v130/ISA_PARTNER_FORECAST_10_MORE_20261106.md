# Cloudflare v130 partner-aware ISA bidding calibration: 10 additional completed hands

2026-11-06. Exact deployed `griffin-house-of-rooks-online` Worker version `4335d4fa-d2ef-4d1e-9bad-dda40e71ce1e`, retrieved through Cloudflare `content/v2`. Ran real bundled `createMatch`, `chooseOnlineBotAction`, `submitBid`, `discardCards`, `chooseTrump`, `playCard`, `observeOnlineX1` in isolated memory. Exposed existing `decidePartner` evaluations on returned action using test-only instrumentation; no production changes. One synthetic human in seat 0, partner ISA in seat 2, Crow seat 1, Jerome seat 3, deterministic seeded deals `0x768a11+trial*35839+271`, trial 5 through 14.

10 of 10 complete, **4 contracts set**. ISA won 7 contracts, was set in 3; partner-assisted auction ran on every hand. Zero rejected game actions. Others: scripted human contract set once (trial 12).

| Trial | Winner | Final bid | Captured | Made | ISA last positive decision projected score utility | Pass utility | Gain | SE |
|---|---|---:|---:|---|---:|---:|---:|---:|
| 5 | ISA | 130 | 165 | yes | +41.2 | +24.4 | +16.8 | 23.3 |
| 6 | ISA | 130 | 180 | yes | -30.2 | -93.0 | +62.8 | 14.4 |
| 7 | ISA | 120 | 115 | **SET** | +85.6 | -85.8 | +171.4 | 17.2 |
| 8 | ISA | 120 | 135 | yes | +43.1 | -61.5 | +104.6 | 19.8 |
| 9 | ISA | 120 | 195 | yes | +123.7 | +29.3 | +94.5 | 9.6 |
| 10 | Crow | 115 | 165 | yes | n/a | n/a | n/a | n/a |
| 11 | ISA | 115 | 95 | **SET** | +0.4 | -40.5 | +41.0 | 12.7 |
| 12 | Human0 | 125 | 90 | **SET** | ISA's earlier offer was 105, not the final contract | | | |
| 13 | ISA | 120 | 105 | **SET** | +12.5 | -39.3 | +51.7 | 9.2 |
| 14 | Human0 | 100 | 125 | yes | n/a | n/a | n/a | n/a |

**Critical interpretation:** `decidePartner`'s `value` and `gain` estimate expected *team score-difference utility under hypothetical continued auctions and simplified card-play*, NOT point captures and NOT make probability of the exact candidate bid. Trial 7 forecast +171.4 vs passing but lost by 5 points after actual full X1 card play. This does not alone prove the bid selection was irrational (passing might have been worse), but it exposes substantial mismatch risk between simulated auction/play worlds and actual results. No arbitrary bid ceiling, and do not compare absolute utility against raw points captured as same units.

Next: record conditional make frequency for each candidate, distinguishing whether bot wins auction vs is outbid and whether opponent/bot is final bidder; use contract-specific make likelihood rather than just average team utility. Re-evaluate with identical sampled worlds and actual X1-style play where feasible. Separate hosted HTTP Play With Friends and client-side single-player acceptance remains outstanding.
