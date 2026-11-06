# Cloudflare v130 X1 play-confidence calibration and first divergent trick traces

Date: 2026-11-06. The exact deployed Worker `griffin-house-of-rooks-online` version `4335d4fa-d2ef-4d1e-9bad-dda40e71ce1e` was retrieved from Cloudflare `content/v2`. In isolated in-memory simulations, a temporary test-only variation changed the `ONLINE_X1.core.choose` selection criterion from `adjusted = d - 0.5 - 0.5 * se` to `adjusted = d - 5 - se`. This was **play-choice confidence**, not a bid cap, bid ceiling, persona modification or production change. All bidding, cards, rules and discard policies stayed unchanged between paired variants.

## Paired tests
- Ordinary seed series `0x9c371 + i*10133`, deals 0–19: 20/20 full pairs completed; same auction in all 20; original and conservative both 0 sets. Total bidding-team captured points: original 3,160, candidate 3,220, with no conclusion about set avoidance (both had zero sets). The latter 12 deals contributed original 1,880 versus candidate 1,920.
- Hard series A, seed `0x371092 + i*17011`, deals 0–11: 12 full pairs completed, same auction in all 12. Original X1 2 sets, stricter confidence 2 sets. Original bidder-team points 1,795, candidate 1,845. One set was rescued and one new set was caused.
- Hard series B, seed `0xb7190 + i*24137`, deals 20–31: 12 full pairs completed, same auction in all 12. Original X1 3 sets, stricter confidence 1 set. Original bidder-team points 1,755, candidate 1,720. Two contracts rescued, but average points worsened.

The 24 hard pairs therefore had original 5 sets and confidence candidate 3 sets, but mixed point performance and a newly introduced failure. This is **not** sufficient to deploy the change and is not evidence that high-value trumps should always be conserved.

## First decision divergence diagnostic
Same exact auction, cards, hand and trump; identify first different played card:
- Hard A deal 5: ISA bid 115, green trump; original leads **green-13** and gets 110 (set), candidate leads **green-7** and gets 125 (made). Same initial hand: green-11, green-1, yellow-1, red-2, green-7, red-10, green-5, black-14, red-12, green-13.
- Hard A deal 9: Jerome bid 115, green trump; original leads **green-13**, earns 115 (made); candidate leads **green-6**, earns 105 (set). Initial hand included green-14, green-10, green-5, green-6, green-1, green-13 and yellow-12, yellow-13. Saving high trump is not universally correct.
- Hard B deal 26: Anchor bid 135, black trump; on a later empty trick, Jerome originally leads **yellow-10**, candidate **yellow-8**. Baseline earns 115 (set), candidate 140 (made).
- Hard B deal 27: Crow bid 120, green trump; after Crow green-7 and Anchor green-12, Jerome originally plays **green-13** while candidate plays **green-6**. Baseline earns 100 (set), candidate earns 120 (made).

## Diagnosis and next test
A critical source of variability is **X1's actual trump-spending and trick-choice policy** compared with the simplified Sol7 continuation used during bidding evaluation. The observed divergent play can swing contract outcome in both directions. Do not institute a fixed bidding ceiling, simplistic save-trump rule, or unconditional replacement of X1 with Sol7.

Next isolate *why* the estimated value favored each candidate play: record sampled reference, mean utility difference, uncertainty, remaining trump strength, partner's public/known information and expected tricks. Then test a **context-sensitive** choice policy, including when a teammate has already led a winning trump. Test all-bot, human/bot partnership and mixed multiplayer configurations. Validate production-equivalent HTTP room flow and client-side single-player separately.

No deployed Cloudflare Worker, live rooms or career records were modified.
