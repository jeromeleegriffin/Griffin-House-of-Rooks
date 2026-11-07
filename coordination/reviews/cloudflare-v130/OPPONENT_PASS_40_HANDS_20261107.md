# Live Cloudflare Rook opponent bot pass investigation, 2026-11-07

## Live source
Retrieved active Cloudflare Worker `griffin-house-of-rooks-online` deployed version `e8d0abbf-67cf-424c-b771-9ef2046d0c95`. Used its bundled **actual** `worker-cloud-only.js` functions, not an outdated GitHub simulator. No live changes, bid caps, or new bidding behavior.

## Hypothesis
Could opponents Crow and Jerome pass when they should bid, indirectly causing a human+ISA partnership to win a weak contract and get set?

Bot-without-human-partner bid source:
```js
const cap = ONLINE_X1.core.ceiling(v.h,{seat,high:v.high,history:v.history,scores:v.scores});
const ask=v.high+5;
let value = cap >= ask && ask <= v.limit ? ask : 0;
```
If bidding has already started, `decideJump` can consider a larger raise, constrained by that hand-dependent heuristic threshold. **This is not a hard universal limit on contract sizes**, and owner rejects any artificial bid cap.

## 40 actual-engine complete-hand samples
One scripted human seat 0 + ISA human-aware bot seat 2 against opponent bots Crow seat 1 and Jerome seat 3. Deterministic seeds `0xacc911 + trial*64923`, trials 0–39. Full auction, nest, discard, trump and 10 tricks, correct public-state observation for **all** player actions. This is in-memory engine execution, not actual hosted room/browser acceptance.

- 40/40 complete hands.
- Opponents recorded **68 passes** and **67 positive raises**.
- **0/68 passes contradicted the current bidding-strength threshold**: every pass had `cap < next legal bid`.
- **8/68 passes were only five points below the next legal bid** (5 in trials 0–15, 3 in trials 16–39), indicating close decisions where heuristic calibration deserves closer review. None were a rules/dispatch error.
- ISA won 21 contracts and was set in 4.

## Targeted counterfactual: eight same-deal replays
Replayed trial IDs 11, 12, 24, 26, 27, 29, 30, 31 with exact same shuffle and all original bots, changing only the **first opponent pass** where calculated cap equaled the current high bid (next legal raise is 5 higher). This is a *deliberately forced hypothetical opponent raise*, not a proposed production behavior.

- Changed opponent action in 3 of 8 replays.
- Trial 11: original ISA 125, team captures 85, set. Forced Jerome over his heuristic threshold to 130; ISA counter-raised to **135**, still captured 85 and got set **more severely** (-135 instead of -125). Here opponent passing was **better** for human team.
- Trial 24: original ISA 125, captured 100, set. Forced Crow raise to 130; Crow then won 130 and captured 170, made. ISA no longer held the contract, but opposing team made a winning 130. Human team's score delta shifted from -125 to +30 while Crow's side got +170. This shows who wins the contract changes, but not necessarily the relative win outcome.
- Trial 26: original scripted human bid 115, captured 105 and got set. Forced Jerome raise; synthetic human counter-raised to 125 and was set more severely.
- Five other tested deals were unchanged because the near-threshold opportunity did not arise.

## Conclusion
No evidence opponents are erroneously *passing against their currently coded threshold*. They may nevertheless be **too conservative in the threshold's ability estimate**, a different hypothesis requiring calibrated expected points and opponent win probability. A premature pass can leave an aggressively bidding human+ISA team on the hook, but forcing opponents to raise is not generally safe; the two studied ISA set cases responded differently.

Suggested next diagnostic (not a bid cap): evaluate whether opponent strength estimate `ceiling()` is calibrated against actual **same-hand outcomes** when they get the nest, choose trump, and play. Compare utility of different auctions, team-relative score, and make rates across many independent deals; only modify AI after paired validation. Preserve main game's single-player and multiplayer settings, rules, and human partner privacy.
