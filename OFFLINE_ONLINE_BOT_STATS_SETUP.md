# Griffin House of Rooks — Offline/Online + Bot Career System

## REQUIRED DESIGN
This progression system is **local-first**. Internet is optional.

A player who never has internet must still earn career points, levels, achievements and every supported statistic. Named bots must earn the same career statistics and achievements as humans. All of that data is saved locally first. Cloudflare is a backup/synchronization destination, not the authority required for gameplay.

When internet later becomes available, queued local snapshots are sent to Cloudflare automatically. Losing service must never stop scoring or progression.

## CURRENT STATUS
Everything remains dormant because `progression.js` still has `CONFIG.enabled:false`. The offline-first code is installed but does nothing until the progression system is deliberately activated.

## LOCAL STORAGE MODEL
Each installation gets `horInstallIdV1`.

Each human or bot gets a local career ledger under `horCareerLedgerV1:<actorType>:<actorId>`.

Each ledger contains actor type, actor ID, installation ID, stats, achievements, revision number and last update time.

Unsynced work is stored in `horProgressOutboxV1`. Only the newest pending snapshot for each actor is retained, preventing an offline player from generating thousands of redundant network jobs.

## HUMANS
The human uses the anonymous player ID when identity is enabled. Before cloud identity exists, the installation has a stable guest ID. No login is required to accumulate local progression.

Every authoritative scoring event must update the local ledger FIRST. Never wait for Cloudflare before displaying or saving a point, level or achievement.

## BOTS
Every named bot must call the exact same local career update path as a human. The helper is:

`HORProgression.offline.recordBot(botName, mutator)`

Bot IDs are stable normalized names such as `bot-cinder`. Do not create a fresh bot ID every game. If two different bot personalities can share a visible name, give them a permanent internal bot ID instead and use that.

Bots must track points, hands, games, wins, tricks, Rook captures, Red 2 captures, big tricks, nest wins/points, bids, contracts, Moon stats, streaks, exact bids, close/rout/comeback wins, sweeps, best hand/trick, Bird + Red 2, trump colors, achievements and levels exactly like humans wherever the game rules make that statistic applicable.

## OFFLINE PLAY
On every completed authoritative event:
1. Determine the affected human/bot actor.
2. Update that actor's local ledger.
3. Evaluate achievements locally.
4. Save the local ledger.
5. Queue the newest actor snapshot in the outbox.
6. Update local UI immediately.
7. If offline, STOP. Gameplay continues normally.

There is no retry popup and no requirement to connect.

## WHEN INTERNET RETURNS
The browser has an `online` listener. When the system and cloud switch are enabled, it calls `HORProgression.offline.flushOutbox()`.

Also call `flushOutbox()` at safe points: game/lobby startup, after a completed game, after successful recovery, and when opening the Career screen. A failed sync stays queued and should be retried later without bothering the player.

## LOCAL SORTING / LEADERBOARD
`HORProgression.offline.localLeaderboard(stat, actorType)` returns locally known actors sorted by a statistic. This allows an entirely offline installation to show human and bot rankings.

Examples:
- `localLeaderboard('points')` — humans + bots
- `localLeaderboard('points','bot')` — bots only
- `localLeaderboard('gamesWon')` — sort everyone by wins

Cloud/global leaderboards are a separate view and only appear when available.

## CLOUDFLARE REQUIREMENTS BEFORE ACTIVATION
The Worker must accept both `actorType: human` and `actorType: bot` snapshots. D1 should key records so human and bot identities cannot collide. Store `installId`, `revision`, timestamps, stats and achievements.

The current dormant Worker template must be upgraded to understand `offlineFirst:true` payloads before cloud sync is enabled.

IMPORTANT: never add two full cumulative snapshots together during reconnect. That double-counts data. The installed browser merge helper uses maximum values for monotonic counters and unions achievements. For production, the stronger design is server-side per-installation/per-actor revisions or event IDs so the Worker can deduplicate uploads. Do that before allowing the same human career to be actively changed on multiple devices.

## RECOVERY / NEW DEVICE
Recovery must download the cloud career and merge it into the new device's local ledger without erasing valid offline progress. Achievements are unioned. Monotonic lifetime counters must never move backward.

Do not simply replace a newer local ledger with an older cloud snapshot.

## EXACT ACTIVATION ORDER
1. Start from the newest working game, not blindly from this old package.
2. Back it up.
3. Port `progression.js` and these documentation files into that build.
4. Verify all existing legacy stats and bot names.
5. Hook HUMAN stat events to `recordHuman()`.
6. Hook every NAMED BOT to `recordBot()` at the same authoritative events.
7. Test with Wi-Fi/cellular disabled for multiple complete games.
8. Close/reopen the browser/app and verify all human and bot stats remain.
9. Verify local levels and achievements unlock offline.
10. Verify local sorting works offline.
11. Deploy/upgrade D1 and the Worker for offline-first actor snapshots and deduplication.
12. Set the Worker endpoint.
13. Enable identity locally and test; still leave cloud off.
14. Enable cloud sync in a private test build.
15. Play offline, accumulate human AND bot stats, then reconnect.
16. Confirm Cloudflare receives all actors and nothing doubles.
17. Repeat disconnect/reconnect several times.
18. Test recovery onto another device and merge behavior.
19. Test clearing browser data only after recovery is proven.
20. Build Career/Achievement UI and local/global leaderboard views.
21. Turn notifications on only after counters are verified.
22. Set the master `enabled:true` LAST in the release build.

## MUST-PASS TEST
A phone in airplane mode must be able to play indefinitely. Human and bots continue accumulating stats, career points, levels and achievements. The app can be closed and reopened and those records remain. When connectivity returns, the game continues without interruption and the pending data reaches Cloudflare once, without losing or double-counting anything.

That is the release requirement for this system.
