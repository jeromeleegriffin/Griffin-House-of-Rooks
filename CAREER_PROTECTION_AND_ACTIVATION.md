# GRIFFIN HOUSE OF ROOKS — CAREER PROTECTION + LOCAL ACTIVATION
## RookGame453

This file is the permanent checklist for protecting careers and turning on LOCAL progression before Cloudflare is ready.

## CURRENT SHIPPING STATE
RookGame453 ships SAFE/DORMANT. In `progression.js`, `CONFIG.enabled` is `false` and cloud is `false`.
The existing Rook game continues to use its current lifetime statistics. The new progression ledgers do not take over merely by installing this ZIP.

## WHAT CAREER PROTECTION NOW CONTAINS
1. Existing `rookLifetimeStats` lifetime data.
2. Human and bot progression ledgers (`horCareerLedgerV1:*`).
3. Achievement unlock records.
4. Level-driving career points.
5. Presentation/celebration preferences.
6. Anonymous player identity/device secret when identity is enabled.
7. Pending offline Cloudflare sync outbox.
8. Migration marker so old lifetime totals are not imported twice.
9. A friendly Recovery Code such as `GRF-ABCD-EFGH-JKLM`.
10. Last-backup timestamp.

`HORProgression.protection.downloadBackup()` creates a JSON recovery file containing the protected local career data.
`HORProgression.protection.restoreBackupFile(file)` restores a selected backup file.
`HORProgression.protection.showRecoveryKit()` displays the player's friendly recovery code and explains its limits.

IMPORTANT: Until Cloudflare is enabled, the friendly Recovery Code by itself CANNOT reconstruct erased browser/app storage. The backup file is the offline recovery copy. Once cloud recovery is implemented, the code can identify the cloud career while stronger credentials protect ownership.

## TEST EVERYTHING BEFORE IT COUNTS
Do this while `CONFIG.enabled:false`:
1. Install/run RookGame453.
2. Play the normal game and verify nothing changed.
3. Open the Progression Dry Run (`HORProgression.preview.show()` from the diagnostic path/console until a visible diagnostic button is added).
4. Confirm Jerome and/or Host records and bot records are detected correctly.
5. Preview Normal Achievement, Level Up, Griffin Tier, and Rare Feat celebrations.
6. Review the projected level and retroactive achievement counts.
7. If both Jerome and Host exist, DO NOT merge them automatically. Decide which is the real career or whether a deliberate merge is wanted.
8. Test a backup: run `HORProgression.protection.downloadBackup()` and verify a `Griffin-Rook-Career-Backup-....json` file is saved.
9. Keep that file somewhere outside the browser/app (Files, Drive, another device, PC, etc.).
10. Do not erase real app/site data merely to test restore. Restore testing should be done in a disposable browser/profile/device or with a copied test installation.

## WHAT MUST BE DONE BEFORE LOCAL PROGRESSION GOES LIVE
The framework is installed, but activation is NOT just flipping one switch. Before local go-live, the current game must be wired to feed every real game event into the progression ledger. Required hooks include:
- points captured per player
- hands played
- games played / games won
- tricks won
- Rook captures
- Red 2 captures
- 30+ point tricks
- nest wins / nest points
- bids won / high bid / bids made / bids set
- Shoot the Moon attempts / makes
- exact bids
- win streaks and made-bid streaks
- close wins, routs, comeback wins
- sweep hands
- best hand points / best trick points
- Rook + Red 2 same hand
- trump-color wins
- same-partner wins where applicable

These hooks must update BOTH humans and named bots locally.

## ONE-TIME MIGRATION
Before live local progression starts, import existing `rookLifetimeStats` ONCE into the new ledgers.
- Preserve all provable old totals.
- Calculate the correct level from existing career points.
- Retroactively unlock achievements supported by old counters.
- Do not invent historical special feats that the old game never tracked.
- Store `horProgressMigrationV1` after a successful import.
- Never import the same totals a second time.

## LOCAL-ONLY GO-LIVE SETTINGS (NO CLOUDFLARE YET)
After the event hooks and migration have been tested, use this configuration:

```
enabled: true
uiEnabled: true
notificationsEnabled: true
identityEnabled: true
cloudEnabled: false
recoveryEnabled: false
botProgressionEnabled: true
endpoint: ''
```

Meaning:
- LOCAL career progression = ON
- LOCAL achievements = ON
- LOCAL levels = ON
- humans = ON
- bots = ON
- celebration animations = ON
- anonymous permanent local identity = ON
- backup/restore = ON
- Cloudflare = OFF
- cloud recovery = OFF
- global leaderboard = OFF

## REQUIRED LOCAL GO-LIVE TEST
1. Make a Career Backup FIRST.
2. Turn on the tested local configuration above.
3. Launch game with internet OFF / airplane mode.
4. Verify the old career migrates exactly once.
5. Record Jerome/Host starting totals and each bot's totals.
6. Play a complete hand.
7. Verify each participant receives only the stats actually earned.
8. Verify level progress changes from career points.
9. Trigger/earn an achievement and verify it is recorded before the animation.
10. Close the game completely.
11. Reopen while still offline.
12. Verify human and bot totals, levels, and achievements remain.
13. Play more hands offline.
14. Verify local sorting/leaderboard works without internet.
15. Create a new Career Backup.
16. Only after all of this passes should this become the normal local build.

## WHEN CLOUDFLARE IS READY LATER
Do NOT change the local accounting model. Cloudflare is an additional protection/sync layer.
1. Deploy/test the v2 Worker and database schema.
2. Set `endpoint` to the tested Worker URL.
3. Enable authenticated anonymous identity on the Worker.
4. Test one disposable account first.
5. Turn `cloudEnabled:true`.
6. Keep local-first writes: game writes locally immediately, then queues cloud sync.
7. Confirm offline outbox catches up after reconnection without double counting.
8. Implement/test server recovery records.
9. Only then turn `recoveryEnabled:true`.
10. Test a new device restore using the Recovery Code plus the secure recovery mechanism.
11. Add GLOBAL leaderboard only after sync integrity is proven.

## DATA-LOSS RULE
Never tell a player that a Recovery Code alone protects an offline-only career. Before cloud backup exists, protection requires the exported Career Backup file. The UI must state this clearly.

## FUTURE HANDOFF
Start from RookGame453 or its newest descendant. Read:
- `PROGRESSION_COMPLETE_SETUP_GUIDE.md`
- `OFFLINE_ONLINE_BOT_STATS_SETUP.md`
- `PROGRESSION_PREVIEW_AND_CELEBRATIONS.md`
- `CAREER_PROTECTION_AND_ACTIVATION.md`
Do not bypass dry-run/migration tests. Preserve existing `rookLifetimeStats`. Humans and named bots must work fully offline. Cloudflare must remain additive, not required for play.
