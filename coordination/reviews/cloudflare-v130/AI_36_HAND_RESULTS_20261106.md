# Cloudflare Rook v130 AI test result, 2026-11-06

**Authority**: Cloudflare account confirmed `rooks.jeromegriffin.com` custom domain maps to `griffin-house-of-rooks-online`, deployment `3e860d7b-9d2e-4402-804c-458371ea88cd` (2026-11-02) serving version `4335d4fa-d2ef-4d1e-9bad-dda40e71ce1e` at 100%.

**Method**: Retrieved exact multipart Worker source from Cloudflare `/content/v2`, extracted `worker-cloud-only.js`, compiled it in an isolated in-memory JavaScript environment with deterministic test randomness and missing runtime compatibility shims, and invoked the live `createMatch`, `chooseOnlineBotAction`, `submitBid`, `discardCards`, `chooseTrump`, `playCard`, `observeOnlineX1`, and `onlineX1Proof` functions. These are **engine simulations**, not browser-click-through tests or actual hosted HTTP rooms. The human seats were controlled by a basic scripted action selector. Career and player storage were not touched.

## Results
| Seats | Complete hands | Sets | Bot contracts | Bot sets | Partner decisions | Partner bidding decisions | X1 fallback count | X1 plays |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 human / 3 bots | 12 | 6 | 10 | 5 | 159 | 27 | 0 | 480 |
| 2 humans / 2 bots | 12 | 5 | 8 | 5 | 299 | 43 | 0 | 480 |
| 3 humans / 1 bot | 12 | 4 | 3 | 1 | 149 | 23 | 0 | 480 |
| **Total** | **36** | **15** | **21** | **11** | **607** | **93** | **0** | **1440** |

**Interpretation**: Very high set rates in this small, script-driven sample (41.7% overall; 52.4% of bot-won contracts). This is a defect signal but **not** a reliable live-player population estimate, and it does not prove bids alone caused the sets rather than play quality or scripted-human behavior. No X1 fallbacks in completed hands, so that fallback hypothesis is not supported by this sample. The sample includes the production X1 human-partner bid path and the ISA special handling. Note that these runs did not certify single-player browser UI or the Play With Friends join/reconnect flow.

## Prior test interpretation correction
Earlier 10,000-deal comparisons came from a simplified `x1/core.js` bidder, *not* the Cloudflare v130 production bot. **Do not** use those figures to justify production changes.

## Actions and gates
- No production deployment or live data mutation.
- A separate GitHub branch `audit/cloudflare-v130-ai-validation-20261106` contains a Cloudflare HTTP QA harness using isolated hosted rooms. Initial runner did not produce a complete results file; the check-in may show `no-evidence-file`. Hosted QA is not yet certified.
- Next: larger controlled engine sample across bid bands, bot names, one/two/three-human rosters, scripted human competence levels, all-bot control; compare per-hand actual point totals with contract amounts; revise **production v130** bidding only after paired baseline/candidate simulation and legal/privacy checks.
