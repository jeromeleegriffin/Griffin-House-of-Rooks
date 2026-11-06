# Second paired bidding test: high-bid ceilings are insufficient

2026-11-06. Exact deployed Cloudflare Worker version 130 game functions, extracted from active Worker source, deterministic in-memory game harness. One scripted human and three bots. 8 *new* deals (indexes 10–17), each replayed three times with identical shuffle seeds: original X1, pass on bot bids above 135, pass on bot bids above 125. Same legal action handling and trick-play engine. No production deployment.

| Deal | Bid | Partnership captured | Result |
|---|---:|---:|---|
| 10 | 120 | 100 | SET |
| 11 | 115 | 150 | made |
| 12 | 100 | 165 | made |
| 13 | 125 | 150 | made |
| 14 | 120 | 150 | made |
| 15 | 115 | 100 | SET |
| 16 | 125 | 90 | SET |
| 17 | 115 | 130 | made |

All three strategies yielded **8/8 complete hands, 3 sets, 0 fallbacks**. **Neither threshold changed any bot decision in these eight deals**, and total bidding-team contract score was 385 for every version. No inference about general set rates from this small sample.

**Decision:** Reject a fixed ceiling as an adequate repair. Bots are also getting set at bids of 115, 120 and 125. Next isolate the *estimated probability* of making these ordinary contracts, the role of human-partner support, and lost counters during card play.

Other separate paired test on eight deals (0–7) found original 3/8 sets vs cap-125 2/8 sets; improvements occurred in one auction where 135/75 became 115/155. Do not assume same benefit on all deals.

All work is isolated from live Cloudflare career and rooms.
