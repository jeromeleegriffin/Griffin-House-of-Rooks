# RookGame452 — Progression Preview & Celebration Layer

## Current safety state
The progression accounting master switch remains OFF (`HORProgression.CONFIG.enabled === false`). Cloud sync, identity creation, recovery codes, bot ledger writes, achievement accounting, and migration remain dormant.

RookGame452 adds a read-only dry-run and the presentation/animation layer so the system can be inspected before activation.

## What was added
- Read-only scan of the existing `rookLifetimeStats` already stored on the device.
- Exact lookup for lifetime careers named `Jerome` and `Host`.
- Warning when both Jerome and Host exist as separate records so they are never silently merged.
- Simulation of the level and all currently provable achievements each stored human/bot would receive.
- Local table showing every stored career and whether it is human or bot.
- Dry-run delta function to simulate a future hand without saving it.
- Achievement celebration queue. Multiple unlocks are displayed one at a time.
- Normal achievement animation.
- Level-up animation.
- Griffin-tier medal animation.
- Rare-feat animation.
- Gold/black Griffin House visual treatment, shine sweep, progress bar, and restrained confirmation tone.
- Presentation preferences: Full / Minimal / Off and sound toggle are supported by the presentation engine.
- The presentation engine is separate from accounting. A visual failure can never determine whether an achievement was earned.
- Everything works without internet. Cloudflare is not required for local presentation.

## How to open the dry-run on a phone right now
This is intentionally not added to the normal player UI yet. Open the browser's developer console for the game (or use the same JavaScript-console method used during testing) and run:

`HORProgression.preview.show()`

This only reads local lifetime statistics. It does not save progression, migrate records, create an identity, or contact Cloudflare.

If developer-console access on the phone is inconvenient, the next activation/testing build can expose this behind a hidden multi-tap diagnostic button.

## Celebration-only previews
With the game page open, these do not award anything:

- `HORProgression.preview.celebrate('normal')`
- `HORProgression.preview.celebrate('level')`
- `HORProgression.preview.celebrate('griffin')`
- `HORProgression.preview.celebrate('feat')`

## Read-only simulation APIs
- `HORProgression.preview.simulateName('Jerome')`
- `HORProgression.preview.simulateName('Host')`
- `HORProgression.preview.simulateAll()`
- `HORProgression.preview.findPersonal()`
- `HORProgression.preview.dryRunDelta('Jerome',{points:112,tricksWon:6,rookCaptures:1,gamesWon:1})`

None of these functions write career data.

## Before local progression is activated
1. Run the preview on the actual phone that has the longest-playing career data.
2. Inspect whether `Jerome`, `Host`, or both exist.
3. If both exist, compare totals and decide explicitly whether they represent the same career. Never auto-merge by name guess.
4. Inspect bots and make sure their existing names/records look correct.
5. Preview all four celebration types and adjust size/timing if desired.
6. Back up/export the old `rookLifetimeStats` before the first real migration.
7. Add live hooks for the newer event-only statistics that the old lifetime record cannot prove retroactively (exact bids, close wins, sweeps, comebacks, same-hand Rook+Red2, etc.).
8. Add a one-time migration that imports only provable old counters and records a migration version so it cannot run twice.
9. Activate LOCAL progression only. Keep cloud OFF.
10. Airplane-mode test multiple hands, close/reopen, and verify human and bot progress persists.
11. Only after local behavior is trusted should Cloudflare synchronization be enabled.

## UX rules when active later
- Achievement accounting happens first; presentation happens second.
- Unlocks during active trick/card interaction are queued until a safe presentation moment.
- Multiple unlocks never stack over each other.
- Normal unlocks are brief; major milestones can be larger and longer.
- Full / Minimal / Off controls only the celebration visuals, never the earning of achievements.
- Sound can be disabled independently.
- Near-completion notices should be sparse (for example 75%, 90%, and very near completion), not shown after every routine event.
- Offline and online players get the same local achievement experience.

## DO NOT DELETE
Keep this file with the game. It documents the safety boundary between read-only preview, local progression activation, and later cloud activation.
