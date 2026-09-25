# Dormant Progression / Achievement System — RookGame450

## Current state: OFF and safe
This package installs the framework but deliberately does **not** turn it on. `progression.js` is loaded, but its master `CONFIG.enabled` switch is `false`. With that setting it creates no player identity, no progression UI, no recovery code, no v2 cloud traffic, and changes no game rules. The existing `stats-worker.js` and current stat upload are untouched.

## Included now
- 50 career levels from Rookling to House Legend, using lifetime career points.
- 25 five-tier achievement families = 125 tier medals (Bronze/Silver/Gold/Platinum/Griffin).
- 20 one-off feats.
- Extra-stat model for streaks, exact bids, close wins, routs, comebacks, clean sweeps, best hand/trick, Bird + Red 2, trump-color wins, made-bid streaks and partner wins.
- Anonymous cryptographic player ID and per-device secret generator.
- Optional no-email recovery-code generator (`GRIFFIN-XXXX-XXXX-XXXX`).
- Future cloud API helpers for sync, recovery and restore.
- Separate future Cloudflare D1 Worker and schema. It is not connected to the current worker.
- Bot progression switch, default OFF.

## Important before activation
The extra counters are modeled but intentionally are **not hooked into live gameplay yet**. Hooking them while the master system is dormant would create unnecessary regression risk. When activation day comes, connect the trackers to the exact scoring/bidding/end-game events in the then-current game build, test them, deploy the v2 Worker/database, and only then enable the switches.

## Activation sequence later
1. Preserve the then-current working game as a baseline.
2. Create a Cloudflare D1 database and run `progression-schema.sql`.
3. Deploy `progression-worker.js` separately and bind the D1 database as `DB`.
4. Put that Worker URL in `progression.js` `CONFIG.endpoint`.
5. Add/test live event hooks for the new counters.
6. Build/test Career & Achievements UI.
7. Set `identityEnabled`, `cloudEnabled`, `recoveryEnabled`, `uiEnabled`, and `notificationsEnabled` as desired.
8. Set `enabled:true` LAST.

## Security note
The browser never contains a GitHub or Cloudflare administrative token. Recovery codes are stored by hash in D1. The v2 template authenticates a device with a random player ID plus random device secret. Before a public leaderboard launch, add server-side event validation/rate limiting so a modified browser cannot simply claim impossible statistics.

## Offline-first requirement added
The dormant framework now includes a local career ledger and durable sync outbox for humans and named bots. The intended release behavior is: earn/save/sort everything locally with zero internet; when service returns, synchronize queued snapshots to Cloudflare without interrupting play or double-counting. See `OFFLINE_ONLINE_BOT_STATS_SETUP.md`. This remains dormant while `CONFIG.enabled` is false.
