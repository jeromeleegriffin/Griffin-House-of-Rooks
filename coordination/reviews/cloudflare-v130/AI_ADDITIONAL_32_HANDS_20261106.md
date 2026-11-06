# Additional Cloudflare Worker v130 AI engine hand tests, November 6, 2026

## Source and methodology
Read the live Cloudflare Worker version **4335d4fa-d2ef-4d1e-9bad-dda40e71ce1e** from `griffin-house-of-rooks-online` / `content/v2`; extracted the actual `worker-cloud-only.js`, evaluated its own `createMatch`, `chooseOnlineBotAction`, `submitBid`, `discardCards`, `chooseTrump`, `playCard`, `observeOnlineX1`, `onlineX1Proof` in isolated memory. Deterministic PRNG seeds, simulated human actions using `chooseTestBotAction`. This does **not** replace browser/play-with-friends acceptance. No live room or production write.

### Additional 12 full hands
- 4 all-bot: 1 set, no fallback
- 4 one human: 0 sets, no fallback
- 4 two-human: 2 sets, no fallback
- Notable: ISA contract 165, captured 140 (set); Jerome contract 115, captured 85 (set).
- 12 completed / 3 sets / 0 X1 fallbacks.

### Additional 20 full hands
- Modes: 0, 1, 2, 3 humans, five deals per mode.
- 20 complete; 12 sets. 14 bot contracts / 7 bot sets. 37 partner-assisted bid decisions. 0 X1 fallbacks. Zero incomplete hands.
- Bid bands: under 120: 8 contracts, 2 sets; 120-139: 10 contracts, 8 sets; 140+: 2 contracts, 2 sets.
- Selected failed bot contracts:
  - ISA 135, earned 125
  - ISA 130, earned 105
  - Jerome 130, earned 120
  - Jerome 140, earned 125
  - Jerome 115, earned 65
  - ISA 130, earned 90
- Most user-driven 'human' seats were scripted, so those contracts must not be interpreted as human-player skill measurements.

## Cumulative
Original 36 + 12 + 20 = **68 completed hands, 30 sets**. These are distinct deterministic runs with different seeds, not identical-deal paired comparison. All completed hands reported **zero AI fallbacks**. A subset of sets were caused by simulated humans; a meaningful number were bot-won contracts. This suggests actual overbidding risk but does **not yet isolate bid selection from actual card play**.

## Follow-up
- Create paired comparison using identical 46-card deals and unchanged card-play policy, comparing unchanged Cloudflare X1 bid decisions against carefully constrained bid candidates (no global blind reduction).
- Report bot/partner make probability and score utility, match impact, per-bid band and per-human-count.
- Distinguish hosted multiplayer HTTP / single-player browser from in-memory Worker game engine results.
- Preserve production Worker v130 unchanged until validation/rollback approval.
