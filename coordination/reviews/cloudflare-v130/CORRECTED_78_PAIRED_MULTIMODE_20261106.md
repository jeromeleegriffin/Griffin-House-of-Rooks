# Corrected Cloudflare v130 partner-bidding stress test: 78 paired deals, Nov 6 2026

## Exact live origin and safety
Verified Cloudflare custom-domain Rook Worker `griffin-house-of-rooks-online` still running version `4335d4fa-d2ef-4d1e-9bad-dda40e71ce1e` at 100%. Retrieved its active `worker-cloud-only.js` via `content/v2`. Compiled real deployed `createMatch`, `chooseOnlineBotAction`, `submitBid`, `discardCards`, `chooseTrump`, `playCard`, `observeOnlineX1`, `onlineX1Proof` and original synthetic-human action selector in isolated JS.

**Critical correction:** Real Cloudflare rooms call `observeOnlineX1(room,before,result)` on human actions, including public bid-history and suit-void updates. Prior synthetic-human harness erroneously omitted those observations. These 78 pairs DO call observe for *every* human action and for bots with a decision. Earlier 64-hand ISA set rates and exploratory 111 forced-pass pairs **must not be called production-equivalent** because they missed human observation. The old all-bot comparisons did not suffer this specific defect. This was a harness error, not proof of a live Worker defect.

Each paired deal: A) unchanged deployed X1 bid/play; B) same dealt cards and initial auction, except force the first positive bid proposed by the human-partner bot (ISA at seat 2 if 1/2 humans, Jerome at seat 3 if 3 humans) to pass. Then complete the real auction and play. No artificial bidding maximum, no global reductions, no live writes. Synthetic human agents still use `chooseTestBotAction`, so this cannot predict human-player populations.

Metric: **relative score-difference of the human+bot partnership** for that hand (Team A's `scoreDeltaA - scoreDeltaB` for ISA, Team B's `scoreDeltaB - scoreDeltaA` for Jerome). Delta = forcing pass minus original. Positive delta means passing helped, negative means original bid policy helped.

## Results of corrected paired experiment

| Mode | Distinct paired deals | Pass better | Pass worse | No change | Total score-difference change if forced pass |
|---|---:|---:|---:|---:|---:|
| 1 scripted human + ISA and two other bots | 62 | 16 | 28 | 18 | **-2,300** |
| 2 scripted humans + ISA and Jerome bots | 8 | 2 | 4 | 2 | **-620** |
| 3 scripted humans + Jerome bot | 8 | 1 | 3 | 4 | **-250** |
| **Total** | **78** | **19** | **35** | **24** | **-3,170** |

There were **156 scenario executions**: 78 baseline and 78 counterfactual. Five one-human counterfactuals ended in an immediate **redeal**, which is treated as a *zero point change in that dealt hand*, not a completed match or a true long-term value estimate. Thus all original runs completed full hands; the counterfactual arm completed 73 hands and had five redeals. All valid actions; no Worker production change.

The 2-human batch had 31 recorded partner-aware bid decisions in original arms; the 3-human batch had 12, verifying that the exact deployed Worker consults human partner information in both mixed configurations. Strong example: 2-human trial 5, original ISA auction produced +170 for partner team; forcing ISA pass resulted -150, harm -320. Three-human trial 0, original Jerome partnership +50 vs -235 on pass, harm -285.

The aggregate difference of -3,170 / 78 ≈ **-40.6 team relative-score points per dealt hand** under this simplified setup. This does NOT imply that the AI is optimal or its set rate is good. It means **blind forced passing loses considerable value by giving up control of the auction**, even though 19 individual deals improved.

## New diagnostic takeaway
The next AI target should be **conditional opponent-auction continuation and contract make probability under actual X1 play**, not blindly decreasing bids or increasing passes. The same bot's decision can be valuable even when its contract later sets, because another team might do even better if allowed to win the auction.

No limits, no rollout to live, no changes to bot personalities. Real Cloudflare hosted Play With Friends flow, online room reconnect and browser single-player acceptance remain unverified by this in-memory experiment.
