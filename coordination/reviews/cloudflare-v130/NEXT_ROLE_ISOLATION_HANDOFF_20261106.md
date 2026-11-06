# Cloudflare Rook AI investigation: next experiment and environment status

Date: November 6, 2026. Continue from the existing 112 unpaired hands and 24 X1/Sol7 paired hands. **DO NOT RESTART. DO NOT APPLY ANY BID LIMITS.**

## Current blockers
- Cloudflare's authenticated script-content endpoint and deployment endpoint returned HTTP 503 ("no healthy upstream") during this turn. No fresh source was acquired.
- The existing GitHub-hosted QA runner's last saved outcome remains `no-evidence-file`; do not claim hosted Play With Friends passed.
- The exact deployed Worker remains the last verified version `4335d4fa-d2ef-4d1e-9bad-dda40e71ce1e` (100% on Nov 2 deployment), subject to recheck after the service recovers.

## Next executable comparison (same cards and auctions)
Use an isolated in-memory harness built **from the exact deployed Cloudflare Worker**, not old GitHub `x1/core.js` as a replacement. For each seeded deal, compare:
1. Baseline: original X1 choices for all seats.
2. Bidder-side Sol7: use the frozen Sol7 move rule **only for seats on the bidding partnership** during play.
3. Defender-side Sol7: only on defending partnership seats.
4. All Sol7: comparison reference.

Hold the shuffle, 4 player hands, nest, bidder, bid, discard, trump, and all other rules constant; assert identical auctions before comparing. Begin with all-bot control, then one-human, two-human, three-human synthetic seats, keeping human policy fixed. Record team points, sets, set margins, role-specific first divergent trick, partner assist usage and unexpected actual engine fallbacks. Any example must be traceable by seed and Worker version.

The purpose is to distinguish whether X1's forecast-to-actual-play mismatch is primarily bidder-team play or defender strategy; this can guide a tactical fix rather than a global change in bid aggression.

## Evidence already verified
- 24 paired all-bot deals with X1 and all-Sol7 play: X1 was set 5 times, Sol7 2 times, with different captured points on 20 deals.
- Varying card-choice confidence rescued some sets but also created a new failed contract; therefore not approved.
- Doubling early-hand X1 samples failed to reliably prevent sets; therefore not approved.
- First-play divergences include ISA trump green-13 vs green-7, and Jerome green-13 vs green-6; opposite outcomes show no universal "save strong trump" rule works.
- Partner-aware bidding already exists in the actual live Worker.

## Publication guard
No production Worker uploads or deployment, no career/account writes, no automatic bid ceilings. A candidate must show repeated paired improvements in expected score and make rate, plus verify actual Cloudflare hosted single-player, friends, and online flows before production.
