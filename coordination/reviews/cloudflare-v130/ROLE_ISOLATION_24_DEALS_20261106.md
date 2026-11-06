# Cloudflare v130 AI role-isolation tests, November 6, 2026

Verified production Worker `griffin-house-of-rooks-online` was still `4335d4fa-d2ef-4d1e-9bad-dda40e71ce1e` (100%). Downloaded **exact active Worker source** from Cloudflare `/content/v2`, extracted bundled `worker-cloud-only.js`, and exercised its real `createMatch`, `chooseOnlineBotAction`, `submitBid`, `discardCards`, `chooseTrump`, `playCard`, `observeOnlineX1`, and `onlineX1Proof` in an isolated in-memory JavaScript harness. No production writes. Fixed shuffle seeds; no bid limits. This is NOT hosted HTTP/browser/physical phone acceptance.

## Experiment
Four paired variants per all-bot deal: original X1 on both teams, Sol7 only on the bidding partnership, Sol7 only on defenders, and Sol7 on both. All bids, bidder, shuffled cards, nest, discard and trump remained identical across variants; card-play decisions differed only in the designated role. Sol7 used the **same Worker-supplied** `ONLINE_X1.core.solmove`, never older GitHub source. Both teams remained bots ISA, Crow, Anchor and Jerome. First 6 deals used `0x4ad721 + deal*35839`, next 8 continued seeds 6-13.

| Variation | Hands completed | Sets | Total bidding-team points |
|---|---:|---:|---:|
| X1 original | 14 | 1 | 2250 |
| Sol7 bidder team only | 14 | 2 | 2105 |
| Sol7 defending team only | 14 | 1 | 2350 |
| Sol7 all seats | 14 | 1 | 2190 |

**Interpretation:** In this sample, X1 helps bidding partnership play relative to substituting Sol7 for its decisions. Defender substitution sometimes gave bidding team more counters, showing X1 may also be a strong defense. This is evidence **against wholesale substitution of X1** even though isolated full-Sol7 earlier trials rescued some sets. No inference of population performance from 14 deals.

## Mixed-human-seat engine comparison
Separate deterministic `0x768a11 + deal*35839 + humanCount*271`, five deals with one human plus three bots, five deals with two humans plus two bots. Synthetic human actions use existing Worker `chooseTestBotAction` (not real human players). Compare X1 baseline, Sol7 on bidding-side bots only, Sol7 on defending-side bots only. All 30 runs completed and auctions identical across variants.

| Variation | Unique paired deals | Sets | Captured by bidding team |
|---|---:|---:|---:|
| X1 baseline | 10 | 5 | 1310 |
| Bidder-side Sol7 | 10 | 5 | 1325 |
| Defender-side Sol7 | 10 | 4 | 1360 |

Baseline mixed breakdown: one-human 3 sets in five deals; two-human 2 in five. Human-partner bid engine `decidePartner` exercised **26 bid decisions** in each comparison arm. In one-human deal 1, ISA bid 115, got 100 with X1, and 125 with Sol7 on the defenders (made). One-human deals 2 and 3 had ISA bid 130 (captured 75) and 135 (captured 55), respectively. These could indicate weak contract forecasts with a scripted-human teammate, but are not proof the human partner-card access is broken. Note: the synthetic human player itself is a simplistic policy.

## Next experiment
Do **not** replace X1 with Sol7 or introduce any bid limits. For human-partner cases, measure the partner-aware bidder's sampled predicted *make probability* versus realized outcomes on the exact same deals; audit how partner hand is constrained in sampled worlds, all-pass and auction continuation. For trick play, trace the deciding teammate/defender card choices and whether sampled continuation is calibrated to actual X1. Verify the real single-player browser and hosted Play With Friends joins separately; in-memory engine only does not certify these UX paths.

No production updates, account writes or gameplay migration were made.
