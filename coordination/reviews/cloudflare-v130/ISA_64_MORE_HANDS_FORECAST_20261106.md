# Cloudflare Rook v130: 64 additional ISA + human-partner complete-hand tests

Date: November 6, 2026, afternoon. The authenticated Cloudflare Workers deployment endpoint verified `griffin-house-of-rooks-online` still serves version `4335d4fa-d2ef-4d1e-9bad-dda40e71ce1e` at 100%. Re-downloaded its exact `worker-cloud-only.js` from the deployed multipart `content/v2` bundle for each isolated batch. Evaluated live `createMatch`, `chooseOnlineBotAction`, `submitBid`, `discardCards`, `chooseTrump`, `playCard`, `observeOnlineX1`, `onlineX1Proof`. No production writes.

The only test instrumentation exposes `ONLINE_X1.bidding.decidePartner()`'s existing candidate utility evaluations on the return object. This does not change card play or bidding. **No bid ceilings, no artificial bid limits, no persona modifications.**

Four batches of **16 complete hands each**, seeded with `(0x768a11+trial*35839+271)>>>0` and trials 15–78. Human0 at seat 0 with a **scripted/simple** move policy (`chooseTestBotAction`), partner ISA at seat 2; Crow and Jerome oppose at seats 1 and 3. The real bots use the deployed Cloudflare X1 engine.

| Trial IDs | Completed | All sets | ISA-won contracts | ISA sets | Partner-aware bid decisions | X1 fallbacks |
|---|---:|---:|---:|---:|---:|---:|
| 15–30 | 16 | 6 | 10 | 4 | 19 | 0 |
| 31–46 | 16 | 8 | 12 | 8 | 21 | 0 |
| 47–62 | 16 | 5 | 11 | 4 | 27 | 0 |
| 63–78 | 16 | 6 | 9 | 2 | 26 | 0 |
| **Total** | **64** | **25** | **42** | **18** | **93** | **0** |

ISA set rate on bot-won contracts here **18/42 = 42.9%**. All-contract set rate **25/64 = 39.1%**. This is not a live-player estimate: synthetic human play is simplistic and can be the source of some failures.

### Selected reproducible ISA sets
- Trial 17: ISA bid 140, team took 70; chosen bid gain vs pass +32.4 score utility, SE 25.3.
- Trial 22: ISA bid 130, team took 110; gain +40.9, SE 14.1.
- Trial 25: ISA bid 120, team took 65; gain +30.1, SE 9.6.
- Trial 31: ISA bid 120, team took 95; gain +11.4, SE 14.7.
- Trial 34: ISA bid 125, team took 120; gain +5.7, SE 4.5.
- Trial 35: ISA bid 120, team took 65; gain +32.3, SE 11.6.
- Trial 37: ISA bid 115, team took 95; gain +41.6, SE 14.8.
- Trial 43: ISA bid 130, team took 65; gain +53.6, SE 14.1.
- Trial 52: ISA bid 140, team took 120; gain +26.2, SE 23.4.
- Trial 58: ISA bid 135, team took 130; gain +79.2, SE 16.6.
- Trial 60: ISA bid 115, team took 70; gain +31.1, SE 20.6.
- Trial 62: ISA bid 125, team took 120; gain +32.2, SE 17.8.
- Trial 63: ISA bid 140, team took 105; gain +27.5, SE 25.5.
- Trial 74: ISA bid 125, team took 115; gain +12.6, SE 8.9.

### Interpretation
`decidePartner` optimizes **estimated score-difference utility under a sampled continued auction**, not conditional probability that a selected contract will make. These measurements show bids can appear better than passing while the actual contract fails; some are marginal, others are not. This does **not** prove that passing would outperform the bid, since the alternative auction outcome hasn't yet been re-played on the same original deal.

This batch isolates 64 independent hands in the 1-human+bot-partner setup. It does **not** certify the browser single-player UI, Play With Friends join/reconnect, or real online network gaming. Do not infer that from these engine tests. More detailed multi-mode work remains separate.

### Next focused test
Use reproducible trials to compare the **predicted distribution of final bidders, contracts and partner-team make probabilities** under bidding/pass alternatives (including opponent auctions). Test the complete counterfactual auction and actual X1 card play on the same deal, not an arbitrary bid cap. Alternatively, improve `decidePartner`'s simulated continuation model and validate paired outcomes. Keep current deployed Worker untouched until a candidate is robustly supported.
