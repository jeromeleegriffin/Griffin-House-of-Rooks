# Cloudflare Rook v130 paired contract cap experiment

Date: 2026-11-06. Tested using extracted live Worker v130 `worker-cloud-only.js` (version `4335d4fa-d2ef-4d1e-9bad-dda40e71ce1e`) with deterministic in-memory game harness. **No production changes.**

Compared original bot bidding against an experiment that changes only a *bot* proposed bid above 125 to pass, leaving the same shuffle seeds, original card-play engine, opponents and settings. Eight paired deals with one scripted human plus three bots.

| Deal | Original bid / team points / set | Test bid / team points / set | Test changed auction? |
|---|---|---|---|
| 0 | 120 / 200 / no | 120 / 200 / no | no |
| 1 | 115 / 85 / yes | 115 / 85 / yes | no |
| 2 | 125 / 175 / no | 125 / 175 / no | no |
| 3 | 120 / 75 / yes | 120 / 75 / yes | no; bidder scripted human |
| 4 | 100 / 145 / no | 100 / 145 / no | no; bidder scripted human |
| 5 | 135 / 75 / yes | 115 / 155 / no | yes |
| 6 | 140 / 145 / no | 130 / 140 / no | yes; altered auction won by scripted human |
| 7 | 145 / 155 / no | 125 / 160 / no | yes |

Results: original 3 sets/8, test 2 sets/8, zero X1 fallbacks. Both variants completed all eight hands. Test altered 3 auctions. **Do not infer that a universal bid cap of 125 is optimal**: this experiment changes who wins the auction and therefore trump selection/discard, and sample is small. It is a feasibility signal, not production-ready AI or multiplayer proof.

Prior cumulative unpaired test results: 68 complete hands / 30 sets; original 36 + additional 12 + additional 20. This experiment is separate from those 68.

Follow up: expand paired samples; compare expected score and match-win outcomes rather than minimizing sets alone; test alternative uncertainty/risk-aware bidding instead of unconditional cap; verify 1,2,3-human multiplayer and separate client-side single-player path.
