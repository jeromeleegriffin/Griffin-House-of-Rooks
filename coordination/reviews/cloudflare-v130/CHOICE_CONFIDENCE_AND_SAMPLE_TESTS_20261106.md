# Cloudflare v130 X1 actual-play calibration experiments — November 6, 2026

Source: exact active `griffin-house-of-rooks-online` Worker version `4335d4fa-d2ef-4d1e-9bad-dda40e71ce1e`, retrieved from Cloudflare `content/v2`, isolated in-memory engine execution. No production or saved-data writes. All test candidates retain identical cards, bidding, discards and trump; **no bid restrictions**.

## Candidate A: higher confidence before leaving Sol7 reference play
Test-only source change **inside original core X1 choose only**: `adjusted = d - 0.5 - 0.5 * se` → `adjusted = d - 5 - se`. This modifies **card-choice confidence**, not allowable bid sizes.
- 20 ordinary paired deals, all complete, identical auctions, 0 sets in both arms. Captured points: original 3160, candidate 3220.
- 12 hard A paired deals, all complete, identical auctions, original 2 sets, candidate 2; total captured points original 1795, candidate 1845. It rescued one ISA set but **caused one new Jerome set**.
- 12 hard B paired deals, all complete, identical auctions, original 3 sets, candidate 1; captured original 1755, candidate 1720.
- The 24 hard paired deals combined: original **5 sets**, candidate **3**, but inconsistent per-deal gains and losses. This candidate is **not approved**.

## Candidate B: 256 X1 early-play world samples instead of 128
Test-only X1 core change `samples = h.length <= 3 ? 256 : 128` → `samples = h.length <= 3 ? 256 : 256`. No bid modifications.
- 8 hard B paired deals (20–27): baseline 3 sets, doubled samples 2; captured points 1050 vs 1065. In baseline set deals 21 and 26, increased sampling captured even **fewer** points; deal 27 was rescued.
- 8 hard A paired deals (0–7): baseline 2 sets, doubled 2; captured points 1115 vs 1095. Both failed contracts stayed set, now with worse points.
- Combined 16 paired deals: baseline **5 sets**, doubled **4**, captured points 2165 vs 2160. Doubles decision compute cost for first seven cards and is **not justified** by these results.

## Crucial first-divergence X1 projected utility details
Using deployed X1 core `choose` (128 samples), at first differing played card:
- Hard A #5 ISA, bid 115, green trump: Sol7 reference green-7 vs X1 chosen green-13, simulated X1 gain +9.10 score utility. Realized original 110 points (set) vs confidence candidate 125 (made).
- Hard A #9 Jerome, bid 115, green trump: reference green-6 vs X1 chosen green-13, estimated X1 gain +6.37. Realized original 115 (made) vs candidate 105 (set). **High trump is not always wrong.**
- Hard B #26 Jerome, yellow lead, black trump: reference yellow-8 vs chosen yellow-10, estimated gain +13.28. Bidding team Anchor 135: original 115 (set), candidate 140 (made).
- Hard B #27 Jerome follows green trump: reference green-6 vs chosen green-13, expected +8.28, original bidding team Crow 120 captured 100 (set) vs candidate 120 (made).

## Interpretation and next diagnostic
The gap between **expected score utility** in sampled future worlds and **realized team captures** can flip the contract outcome. Shifting the confidence margin or doubling world samples can help isolated deals but both showed drawbacks, so **do not deploy either heuristic change**.

Investigate improved world conditioning and actual-play-policy calibration: inspect hidden-card sampling, partner-trump preservation, leading and following trump, how `solmove` is used to continue simulated futures within `core.choose` and `decidePartner`, and whether predicted values reflect contract make probability under actual X1 play. Use paired same-card trials and replay trick differences.

**Scope caveat:** All tests above were in-memory runs of Cloudflare code, not fully networked Play With Friends, browser single-player, or phone acceptance. User requires all three modes validated. Do not claim those passed. Owner explicitly rejected any fixed bid limit. No production Worker, room, or saved career was changed.
