# Cloudflare Rook v130 counterfactual human-partner bidding, corrected memory observation, Nov 6 2026

## Scope and safety
Production custom-domain Worker `griffin-house-of-rooks-online` confirmed on active version `4335d4fa-d2ef-4d1e-9bad-dda40e71ce1e`, 100%. Exact Worker module retrieved from Cloudflare `content/v2` and run **in-memory**, with its real `createMatch`, `chooseOnlineBotAction`, `submitBid`, `discardCards`, `chooseTrump`, `playCard`, `observeOnlineX1` and `onlineX1Proof` functions. No live rooms, worker deployment, or career data writes. No bid caps.

### Important correction to previous synthetic-human harness
Actual Cloudflare Worker calls `observeOnlineX1(room, before, result)` for **human actions**, and `observeOnlineX1(room, before, result, decision)` for bot actions. Earlier synthetic-human engine simulations incorrectly skipped the human observations. This drops human positive bidding history and public suit-void updates. In a first six-deal replay with corrected observation, three of six baseline games differed in score (although the final bids were the same). Thus the historical human-partner set rates and earlier 111 counterfactual comparisons **are exploratory and are not production-equivalent**. This is a **test harness issue, not a deployed Worker bug**. The all-bot experiments did not have this particular omission.

### Corrected same-deal design
Synthetic human seat 0 uses Cloudflare `chooseTestBotAction`, partner ISA seat 2; opponent bots Crow and Jerome seats 1/3. For each seeded original deal run:
1. The original live AI's actions, including *all* human observations.
2. Same shuffle, hands and rules, but force ISA's **first proposed positive bid** to pass. Let real X1 handle all subsequent auction and card decisions, including any redeal on all-pass; **observe human actions in memory**.
This is a counterfactual diagnostic, not a recommended policy. When pass causes an immediate redeal, assign zero *current-hand* score difference for descriptive comparisons; this is not a full future match score or an executed next hand. The team value metric is `scoreDeltaA - scoreDeltaB`, with ISA and human on Team A. Seed formula: `(0x768a11+trial*35839+271)>>>0` and dealer `trial%4`.

### Corrected 62 paired deals (124 original/counterfactual game executions)
| Trial range | Pairs | Pass better | Pass worse | Tie | Sum of (pass - original) Team A score-difference |
|---|---:|---:|---:|---:|---:|
| 0–5 | 6 | 4 | 2 | 0 | -35 |
| 6–13 | 8 | 2 | 5 | 1 | -455 |
| 14–21 | 8 | 2 | 4 | 2 | -70 |
| 22–29 | 8 | 1 | 3 | 4 | -535 |
| 30–37 | 8 | 3 | 3 | 2 | +150 |
| 38–45 | 8 | 0 | 3 | 5 | -605 |
| 46–53 | 8 | 0 | 6 | 2 | -765 |
| 54–61 | 8 | 4 | 2 | 2 | +15 |
| **Total** | **62** | **16** | **28** | **18** | **-2,300** |

The pass comparison worsened Team A's score-difference by an average **37.1 points per dealt hand** (negative means *original X1 bidding better on average*). Cases where the forced pass changes the auction are included. Five counterfactuals ended in redeal (trials 19, 20, 42, 51, 59) and their **immediate-hand** score effect was treated as zero, not a match outcome. No test run was rejected for an invalid action. These results do **not** justify automatic passing or reducing bidding aggression across the board.

### Concrete counterexamples
- Trial 33: original ISA bid 125 and Team A ended at -205 difference; forcing pass let Crow bid, resulted Team A at +205: **+410** gain from passing.
- Trial 28: original ISA's 125 gave Team A +200; forcing pass let Crow win and Team A scored -130: **-330** harm from passing.
- Trial 57: original ISA bid 115 and Team A +170; pass let Crow win, Team A -50: **-220** harm.
- Trial 60: original ISA bid 115 and Team A -240; pass let Crow win, Team A -90: **+150** benefit.
- Trial 46: original ISA bid 125 gave +60; pass let synthetic human win and Team A -245: **-305** harm.

## Diagnosis
The model must evaluate the **counterfactual auction and playing policy** conditioned on the real visible information; simply reducing bids because contracts are set loses valuable control of other hands. Both the original and pass auctions can make or get set. Also, because this involves a simplistic scripted human, compare with realistic human-play policies before concluding actual multiplayer player-set rates.

## Next focused steps
- Run similar corrected pairings for 2-human and 3-human tables with proper human observation, and compare partner assistance availability in bidding. Avoid claiming browser/HTTP acceptance; that is still not completed.
- Directly evaluate the simulated `decidePartner` make probability and auction continuation conditional on identical candidate outcomes, versus X1 actual play, without imposing any fixed bid limit.
- Preserve production Worker v130 unchanged until paired improvements survive generalization, human-partner privacy, CPU/legal checks and real hosted-mode testing.
