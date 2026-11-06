# Rook bot bidding audit: isolated test branch

Date: 2026-11-06. Scope: read-only analysis of production; changes on `audit/rook-ai-bidding-partner-20261106` only. No live deployment.

## Finding: bidding can exceed hand estimate
- Standard local `bots.js` computes `extremeAnalyze(hand).ev`, then applies difficulty/persona/auction-pressure modifiers.
- Its opening `minBid` exception may bid even when the estimated hand is below the floor, and its later cap guard exempts that minimum opening.
- This is a *possible* source of sets, not a measured cause without running complete production-engine hands.

## 10,000 paired X1-simplified deals (NOT live bots)
Using frozen `x1/core.js` ceiling and `x1/bidding.js` contract simulation, deterministic PRNG seed 193871, same 10,000 deals for all ceilings. Simulated simplified ascending auctions, a full-contract outcome and standard set penalty. These are not browser turns or production decision engine calls.

| Ceiling adjustment | Contracts | Sets | Set rate | Average bidding-team contract score |
|---|---:|---:|---:|---:|
| 0 | 9999 | 518 | 5.18% | 145.96 |
| -5 | 9995 | 387 | 3.87% | 149.33 |
| -10 | 9990 | 311 | 3.11% | 151.08 |
| -15 | 9969 | 237 | 2.38% | 152.78 |
| -20 | 9898 | 179 | 1.81% | 154.06 |

These comparisons do not show match win rates or the correct future production ceiling; playing policy differs from the current live bot engine.

## Human partner bidding branch
- `cloudflare/live/x1-full/bridge.mjs`: for a bot whose actual partner is human, route normal-rule bid through existing `X1_RULES.bid(x1ExtendedView(..., partner))`; partner hand is directly included in constrained sampler. Other seats retain original bid algorithm.
- `cloudflare/live/x1-full/adapter.mjs`: allow this eligibility for any real bot/human partnership rather than just one-human tables. Partner only, never opponents.
- Paired decision check: 120 deterministic random 46-card deals, own-only versus with real partner hand, 128-sample X1 rules bidder. Different bids on 28, 12 higher and 16 lower. No computation errors. This is a decision-path check, not a 120-hand win-rate check.
- Eligibility tests: seven simulated rosters, including 1/2 human seats, opponent-only human, all bots, and all humans. All seven cases passed; no opponent or bot-bot hand is eligible.
- Syntax parse of changed bridge passed.

## Remaining blockers before production
1. Production-engine full 1,000+ hand simulations, persona-by-persona: complete bidding, discard, trump, trick play, scoring. Needed to identify the source of frequent sets in the *regular* bots.
2. Test actual Worker CPU budget, automatic retry/fallback, varied rule settings, Rook and Red2, Moon, and 1-, 2-, 3-human multiplayer paths.
3. Confirm partner-hand privilege never leaks through network responses, debug endpoints or logs.
4. Examine current production Brain/release pointers, candidate test deployment, owner acceptance, then separately authorize production publication.

No default bid-ceiling reduction has been applied to production or this branch.
