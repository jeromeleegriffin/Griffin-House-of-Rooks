# GRIFFIN HOUSE OF ROOKS — COMPLETE DORMANT PROGRESSION SYSTEM GUIDE

**Package:** RookGame450  
**Purpose:** Permanent handoff/setup manual for the dormant career levels, achievements, anonymous identity, recovery, and future Cloudflare progression system.

---

# 1. CURRENT STATUS — IMPORTANT

The entire new progression framework is installed but **OFF**.

In `progression.js`, the master switch is:

```js
enabled: false
```

As long as that remains `false`, the framework is dormant. It does not create a player ID, does not show progression UI, does not create recovery codes, does not call the new progression Worker, and does not alter game rules.

The existing/legacy statistics system and `stats-worker.js` are separate and were intentionally left alone.

**Do not simply flip `enabled` to true and publish.** The new live-game event hooks and visible Career/Achievements interface still need to be connected and tested first. Follow this guide in order.

---

# 2. FILES THAT BELONG TO THIS SYSTEM

## `progression.js`
Browser-side progression engine. Contains all 50 level thresholds, achievement definitions, anonymous identity generation, local extra-stat storage, recovery-code generation, cloud API helpers, and feature switches.

## `progression-worker.js`
Separate Cloudflare Worker template for the new progression service. It handles player/device authentication, cloud snapshots, recovery-code creation, recovery, and fetching the player's stored record.

## `progression-schema.sql`
SQL used to create the Cloudflare D1 tables needed by `progression-worker.js`.

## `PROGRESSION_DORMANT_README.md`
Short summary of the dormant system.

## `PROGRESSION_COMPLETE_SETUP_GUIDE.md`
This file. Keep it in every future build until the progression system is fully activated and documented elsewhere.

## `stats-worker.js`
The game's existing statistics Worker. It is NOT the new progression Worker and should not be replaced by `progression-worker.js`.

---

# 3. WHAT IS ALREADY BUILT

## A. 50 career levels
Levels are based on the player's lifetime **career points**, not a duplicate XP currency.

The progression begins:

- Level 1 — Rookling — 0 points
- Level 2 — New Hand — 500
- Level 3 — Trick Taker — 1,250
- Level 4 — Nest Hunter — 2,500
- Level 5 — Table Regular — 4,000
- Level 10 — Rook Veteran — 20,000
- Level 15 — Seasoned Player — 50,000
- Level 20 — Rook Expert — 100,000
- Level 25 — Master Bidder — 175,000
- Level 30 — Table Master — 275,000
- Level 35 — Nest Master — 400,000
- Level 40 — Rook Master — 550,000
- Level 45 — Griffin Elite — 750,000
- Level 50 — House Legend — 1,000,000

Every intermediate level also has its own threshold in `progression.js`.

The helper `HORProgression.levelFor(points)` calculates the current level, title, current threshold, next threshold, and percentage progress toward the next level.

## B. 25 five-tier achievement families = 125 medals
Each family has Bronze, Silver, Gold, Platinum, and Griffin tiers.

Installed families:

1. Point Collector — lifetime points
2. Old Hand — hands played
3. Game Night — games played
4. Winner — games won
5. Trick Taker — tricks won
6. Rook Hunter — Rook captures
7. Red 2 Hunter — Red 2 captures
8. Heavy Hitter — 30+ point tricks
9. Nest Raider — nests won
10. Nest Fortune — nest points
11. Bid Winner — bids won
12. Contract Keeper — bids made
13. Moonshiner — successful Shoot the Moon
14. Moon Chaser — Shoot the Moon attempts
15. Bag Collector — bags
16. Hot Streak — longest game-winning streak
17. Exactly — exact bid makes
18. Photo Finish — close wins
19. Dominator — rout wins
20. Clean House — sweep hands
21. Bird & Two — Rook + Red 2 in same hand
22. Comeback Kid — comeback wins
23. Trump Traveler — wins across all trump colors
24. Contract Streak — longest consecutive made-bid streak
25. Partner Power — same-partner wins

The exact five thresholds for every family are defined in the `FAMILIES` array in `progression.js`.

## C. 20 special one-time feats
Installed feats include:

- First Trick
- First Victory
- Got the Bird
- Seeing Red
- Nest Egg
- I'll Take It
- Made It
- Shooting Star
- Bold Bid — bid 150+
- Fearless — bid 180+
- No Fear — bid 200+
- Big Haul — 150+ points in one hand
- Monster Hand — 200+ points in one hand
- Monster Trick — 50+ point trick
- Called It — make a contract exactly
- Too Close — win by 5 or less
- Rout — win by 200+
- Clean Sweep — take every trick in a hand
- Bird & Two — capture Rook and Red 2 in same hand
- Four Colors — win with every trump color

## D. New advanced statistics model
The dormant framework already has storage fields for:

- current winning streak
- longest winning streak
- current made-bid streak
- longest made-bid streak
- exact bid makes
- close wins
- rout wins
- comeback wins
- sweep hands
- best points captured in one hand
- best single-trick points
- Rook + Red 2 captured in same hand
- wins by trump color (black/red/green/yellow)
- all-trump-color-win completions
- same-partner wins
- achievement unlock record
- last update timestamp

These fields exist, but the game-event hooks that increment them are intentionally NOT connected yet.

## E. Anonymous no-signup player identity
When enabled, the browser can generate:

- a random cryptographic `playerId`
- a random 32-byte `deviceSecret`
- a creation timestamp

They are stored locally under:

`horPlayerIdentityV1`

This lets a player be recognized automatically without creating a username/password account.

## F. No-email recovery codes
The browser can generate a code shaped like:

`GRIFFIN-XXXX-XXXX-XXXX`

The Worker stores only a SHA-256 hash of the recovery code. The player can later enter the code on another device to recover the same cloud player identity.

**Important:** recovery currently rotates the player's device secret. In the present template, restoring on a new device therefore invalidates the old device secret. If you want simultaneous multi-device play, change the server model to a separate devices table before public launch.

## G. Cloud API routes already templated
The future Worker provides:

- `POST /v2/sync` — save career/achievement snapshot
- `POST /v2/me` — retrieve the current cloud record
- `POST /v2/recovery/create` — register a recovery code
- `POST /v2/recovery/restore` — restore identity with a recovery code

## H. Bot progression switch
`botProgressionEnabled` exists and defaults OFF. It is reserved for showing levels/badges for named bots later.

---

# 4. MASTER FEATURE SWITCHES

At the top of `progression.js` is `CONFIG`.

```js
const CONFIG = {
  enabled: false,
  uiEnabled: false,
  notificationsEnabled: false,
  identityEnabled: false,
  cloudEnabled: false,
  recoveryEnabled: false,
  botProgressionEnabled: false,
  endpoint: '',
  schemaVersion: 1
};
```

Meaning:

- `enabled` — master kill switch. Nothing activates while false.
- `uiEnabled` — future Career/Achievements screen and lobby career card.
- `notificationsEnabled` — future achievement/level-up notifications.
- `identityEnabled` — anonymous player ID/device secret.
- `cloudEnabled` — permits calls to the new progression Worker.
- `recoveryEnabled` — recovery-code feature.
- `botProgressionEnabled` — bot level/badge display.
- `endpoint` — full URL of the deployed progression Worker.

**Turn `enabled` on LAST.**

---

# 5. COMPLETE ACTIVATION PLAN

Use these steps in this exact general order.

## STEP 1 — Preserve the newest working game
Do not activate against an old copy merely because this guide lives in RookGame450.

When activation day arrives:

1. Start from the newest tested working Rook game.
2. Make a backup ZIP before changing progression code.
3. Confirm normal offline and online gameplay works.
4. Confirm bidding, discarding, trump selection, tricks, scoring, game ending, rematch/new game, and existing statistics work.
5. Keep the progression files from this package available for comparison.

Do not replace a newer `index.html` wholesale with RookGame450's `index.html` if the game has advanced since then. Port the progression files/hooks into the current build surgically.

## STEP 2 — Verify the legacy statistics names
Before wiring achievements, confirm the current game's career-stat object still uses the expected fields:

`points`, `hands`, `gamesPlayed`, `gamesWon`, `tricksWon`, `rookCaptures`, `red2Captures`, `bigTricks`, `nestWins`, `nestPts`, `bidsWon`, `bidsMade`, `moonMade`, `moonAttempts`, `bags`, `highBid`.

If a future build renamed any field, update the matching `stat:` entries in `FAMILIES`/`FEATS` rather than maintaining two conflicting counters.

## STEP 3 — Hook the advanced counters into actual game events
This is the most important unfinished browser-side step.

Connect counters to authoritative moments that occur exactly once. Do NOT infer them from animations or button clicks.

### At each completed trick
After the game has determined the trick winner and trick point value:

- update `bestTrickPoints` if this trick is larger
- existing stats should increment `tricksWon`
- existing stats should increment `bigTricks` when applicable
- remember whether the player captured the Rook in this hand
- remember whether the player captured Red 2 in this hand
- count tricks won in the current hand for sweep detection

### At the end of each hand
After final hand points are known:

- update `bestHandPoints`
- if the same player captured both special cards, increment `rookAndRed2SameHand`
- if the player won every trick, increment `sweepHands`
- clear temporary per-hand Rook/Red2/trick counters for the next hand

### When a bid/contract is resolved
For the winning bidder:

- if the contract was made, increment/maintain the made-bid streak
- if set, reset the current made-bid streak
- update `longestMadeBidStreak` when the current streak reaches a new record
- if final contract result exactly equals the required bid, increment `exactBidMakes`

Use the game's real contract/scoring rules for “exact”; do not guess from UI text.

### When a complete game is won
After the game winner and final team/player scores are final:

- increment current winning streak for the winning human; reset it after a loss
- update `longestWinStreak`
- calculate winning margin
- increment `closeWins` for margin <= 5
- increment `routWins` for margin >= 200
- calculate `comebackWins` only after a precise comeback definition has been chosen and recorded
- record the winning trump color
- update `trumpWins.black/red/green/yellow`
- determine whether all four colors have been won with; increment/award the all-colors progression only according to the final chosen design
- update same-partner statistics only when stable player/partner identity is available

### Definitions that MUST be settled before public tracking
Document these so statistics never silently change meaning later:

- what exactly qualifies as a “comeback”
- whether a 5-point tie boundary counts as Photo Finish (current intended rule: <= 5)
- whether a 200-point boundary counts as Rout (current intended rule: >= 200)
- whether sweep means all tricks by one player or all tricks by the player's team
- whether partner achievements are per named partner, one favorite partner, or aggregate repeats
- how all-trump-color progress resets/repeats after earning a tier

## STEP 4 — Evaluate achievements after authoritative updates
After a completed stat update, create a combined stat snapshot containing legacy career stats plus the new extra stats.

Call:

```js
HORProgression.evaluate(combinedStats, extras.achievements)
```

For every returned unlock:

1. mark its ID in `extras.achievements`
2. save the extras record
3. queue a notification only if notifications are enabled
4. include the achievement record in the next cloud sync

Never award an achievement merely because an animation played; award from final game state.

## STEP 5 — Build/test the Career & Achievements UI while still offline
Before cloud activation, build the UI against local stats.

Recommended lobby career card:

- player display name
- Level number
- Level title
- lifetime career points
- progress bar toward next level
- number of medals/feats earned
- button/open action for Career & Achievements

Recommended Career & Achievements screen:

- Career overview
- current level/title
- points and next-level requirement
- progress bar
- achievement category filters
- each five-tier family shown as ONE card with its five medals
- current progress, e.g. `238 / 250`
- locked tiers visible but clearly locked
- earned date can be added later if stored
- separate Special Feats section

Achievement notifications should be compact and non-blocking during play. Major milestones may get a larger celebration later.

Test the UI at tiny values, near thresholds, exactly at thresholds, beyond thresholds, Level 50, and with old players who already have large lifetime totals.

## STEP 6 — Decide how existing players are grandfathered
Recommended behavior: **retroactively award everything provable from existing lifetime statistics**.

For example, an existing player with 300 Rook captures should immediately qualify for the Rook Hunter tiers whose thresholds they already passed.

Do NOT fabricate historical achievements that cannot be proven from stored data. New statistics such as exact bids or winning streaks should begin at zero unless trustworthy historical data exists.

On first activation:

1. read current legacy career stats
2. merge new extra-stat defaults
3. run achievement evaluation
4. mark all provable historical tiers/feats as earned
5. avoid spamming 30 separate popups; show one “Career achievements imported” summary instead

## STEP 7 — Create the Cloudflare D1 database
In the Cloudflare dashboard, create a new D1 database dedicated to progression. A clear name would be:

`griffin-rooks-progression`

Do not reuse or destroy the database used by the legacy stats system unless you intentionally redesign both systems together.

## STEP 8 — Run the database schema
Open the D1 database console and execute the contents of:

`progression-schema.sql`

It creates:

### `players`
- `player_id` — anonymous stable player ID
- `secret_hash` — SHA-256 hash of device secret
- `created_at`
- `updated_at`
- `career_json`
- `achievements_json`

### `recovery`
- `recovery_hash` — SHA-256 hash of recovery code
- `player_id`
- `created_at`

It also creates an index for recovery lookup by player.

Verify both tables exist before proceeding.

## STEP 9 — Create a NEW Cloudflare Worker
Create a separate Worker for progression rather than replacing the current legacy stats Worker.

Paste the complete contents of:

`progression-worker.js`

into the new Worker.

A clear Worker name would be:

`griffin-rooks-progression`

## STEP 10 — Bind D1 to the Worker
In the progression Worker's bindings/settings:

1. Add a D1 database binding.
2. Set the binding variable name EXACTLY to:

`DB`

3. Select the progression D1 database created earlier.
4. Save/deploy.

The Worker code expects `env.DB`; another binding name will fail unless the code is changed too.

## STEP 11 — Record the Worker URL
After deployment, copy the public HTTPS Worker URL.

Example shape only:

`https://griffin-rooks-progression.<your-subdomain>.workers.dev`

Do not copy the example literally. Use the actual URL Cloudflare gives you.

## STEP 12 — Put the Worker URL into `progression.js`
Change:

```js
endpoint: ''
```

to the real deployed Worker URL.

Do not add a trailing route such as `/v2/sync`; the browser code appends the API paths itself.

## STEP 13 — Test anonymous identity LOCALLY before enabling cloud
With a test build, set:

```js
enabled: true,
identityEnabled: true,
cloudEnabled: false,
recoveryEnabled: false,
uiEnabled: false,
notificationsEnabled: false
```

Load the game once. Verify `horPlayerIdentityV1` is created in localStorage and contains a random `playerId` and `deviceSecret`.

Reload the page. Verify the SAME identity remains.

Close/reopen browser. Verify it remains.

Do not publish yet.

## STEP 14 — Test cloud creation and sync
Now set `cloudEnabled: true` in the test build.

Test `/v2/me` or `/v2/sync` through the browser helper. On first authenticated request, the Worker creates the player row automatically.

Verify in D1:

- one player row appears
- `player_id` matches the browser identity
- only the HASH of the device secret is stored server-side
- timestamps update
- career JSON stores the intended snapshot
- achievement JSON stores the intended snapshot

Reload and sync again. Confirm it updates the same player instead of creating duplicates.

## STEP 15 — Add normal sync points
Do not sync every animation/frame/button press.

Recommended cloud sync moments:

- after a completed hand when career stats changed
- after a completed game
- immediately after important achievement/level changes if needed
- when returning to lobby
- optional best-effort page hide/unload sync, but never rely on unload alone

Keep local stats first so a temporary network failure does not block gameplay.

If cloud sync fails, queue/retry later rather than interrupting a Rook hand.

## STEP 16 — Test recovery code creation
Enable:

```js
recoveryEnabled: true
```

Provide a “Protect/Recover My Progress” area in Career settings.

When the player requests protection, call:

```js
await HORProgression.createRecoveryCode()
```

Display the returned `GRIFFIN-XXXX-XXXX-XXXX` code clearly and tell the player to save it privately.

Do not expose another player's code and do not use the code as a public player ID.

## STEP 17 — Test recovery on a separate test browser/device
On a second browser/profile/device with no existing identity:

1. choose “Restore Progress”
2. enter the recovery code
3. call `HORProgression.restoreWithCode(code)`
4. verify the Worker returns the original `playerId`
5. verify a new device secret is installed locally
6. call `/v2/me`
7. restore/merge the player's cloud career and achievements according to the migration rules
8. confirm the correct level/achievements display

### Current single-device warning
The current recovery Worker changes the secret stored on the player row. Therefore a successful recovery makes the previous device's secret invalid.

Before advertising seamless multi-device support, choose one of these designs:

- **Simple:** recovery transfers the account to the new device and old device must recover again later.
- **Better multi-device design:** add a `devices` table with multiple hashed device secrets per player.

Do not silently promise simultaneous multi-device play with the current template.

## STEP 18 — Add server-side anti-cheat before public leaderboards/rewards
The current `/v2/sync` endpoint stores a client-supplied snapshot. This is sufficient for development/testing and personal cloud persistence, but a modified browser could submit fake totals.

Before using these numbers for competitive public leaderboards, prizes, paid unlocks, or authoritative rankings, strengthen the server design.

At minimum add:

- request rate limiting
- sanity limits on increases per hand/game
- schema/type validation
- reject negative/impossible totals
- monotonic lifetime counters where appropriate
- server-side timestamps
- duplicate-event protection/idempotency
- preferably signed/validated match or hand events rather than trusting arbitrary full snapshots

Never put Cloudflare administrative API tokens or database credentials in `index.html` or `progression.js`.

## STEP 19 — Build recovery/privacy controls
Before public activation, add understandable controls:

- view/copy recovery code or generate one
- restore from recovery code
- explanation that no email/password is required
- explanation that clearing browser data without a recovery method can lose local identity
- privacy information describing what is stored

If analytics/stat collection practices change, update `privacy.html` accordingly.

## STEP 20 — Decide bot progression behavior
Leave `botProgressionEnabled:false` until human progression is stable.

If enabled later, named bots can display calculated levels/badges using their persistent career statistics. Do not create cloud device credentials/recovery codes for bots unless there is a specific server-side reason.

## STEP 21 — Full regression test BEFORE the master launch
Test at least:

- Android Chrome
- iPhone Safari
- desktop browser
- offline/local play
- online/multiplayer play if applicable
- new player with zero history
- established player with large legacy stats
- refresh during lobby
- refresh during/after a game
- network unavailable
- Worker temporarily unavailable
- duplicate sync attempt
- recovery code correct
- recovery code incorrect
- cleared localStorage scenario
- achievement exactly at threshold
- multiple achievements unlocked in one hand
- Level 49 -> Level 50
- no achievement popup blocking discard/bid/trump/play controls
- existing statistics page still correct
- legacy Worker still functioning

Progression must fail gracefully: if Cloudflare is unreachable, the card game should still play.

## STEP 22 — Turn visible features on gradually
Recommended test order:

### Stage A — local progression only
```js
enabled: true
identityEnabled: true
uiEnabled: true
notificationsEnabled: true
cloudEnabled: false
recoveryEnabled: false
```

### Stage B — cloud test
Turn `cloudEnabled:true` only after D1/Worker tests pass.

### Stage C — recovery test
Turn `recoveryEnabled:true` after cloud sync is stable.

### Stage D — bots
Turn `botProgressionEnabled:true` only if desired after human progression is proven.

For the public production build, `enabled:true` should be the LAST deliberate activation change after all dependencies are ready.

---

# 6. DATA/MIGRATION RULES TO KEEP

1. **Career points are the level currency.** Do not introduce a second XP total unless the design is intentionally changed later.
2. Existing lifetime statistics should be reused, not duplicated.
3. Old players receive retroactive achievements only when existing data proves them.
4. New advanced counters start from zero if history cannot prove them.
5. Keep local progress usable when cloud is down.
6. Cloud should merge carefully; never casually overwrite a larger trusted lifetime total with an empty/new-device total.
7. Every future schema/data-format change should increment `schemaVersion` and include migration logic.
8. Never delete legacy stats during progression migration until backups and validation confirm the new system is correct.

---

# 7. RECOMMENDED CLOUD MERGE POLICY

Before public activation, implement a defined merge policy.

For monotonic lifetime counters such as points, hands, games, wins, tricks, captures, etc., the safer recovery merge is generally the larger trusted value rather than blindly replacing cloud with a fresh device's zero.

For records such as `bestHandPoints`, `bestTrickPoints`, `longestWinStreak`, and `longestMadeBidStreak`, use the maximum trusted value.

For achievement IDs, use the union of earned achievements.

For current streaks, use the authoritative most-recent game state rather than maximum.

For timestamps, preserve creation time and update `updated_at` server-side.

This merge logic is NOT yet fully implemented in the dormant template; it must be added/tested during activation.

---

# 8. RECOMMENDED PLAYER EXPERIENCE

The intended public experience is deliberately low-friction:

1. Player enters/uses their normal display name.
2. Game silently creates an anonymous player identity.
3. They play normally without signup/login.
4. Career points automatically determine their level.
5. Achievements unlock from actual play.
6. The lobby shows a compact Career card.
7. Career/Achievements page shows detailed progress.
8. Player may optionally generate/save a recovery code.
9. On a new device they can choose “Restore Progress” and enter that code.
10. Email/password account creation is not required by this design.

---

# 9. WHAT NOT TO DO

- Do not replace `stats-worker.js` with `progression-worker.js`.
- Do not turn `enabled:true` before event hooks/UI/cloud are tested.
- Do not trust browser-submitted totals for competitive rewards without server validation.
- Do not put administrative Cloudflare credentials in browser JavaScript.
- Do not award achievements from animation/UI events.
- Do not wipe existing player statistics during migration.
- Do not assume recovery currently supports two simultaneously authorized devices.
- Do not overwrite a newer working `index.html` with this older build just to obtain progression.
- Do not spam returning veteran players with dozens of individual retroactive unlock popups.

---

# 10. FINAL GO-LIVE CHECKLIST

Before changing the production master switch to ON, all of these should be YES:

- [ ] Current game baseline backed up
- [ ] Legacy stats verified
- [ ] Advanced event hooks connected
- [ ] Achievement calculations tested
- [ ] Career/Achievements UI tested
- [ ] Existing-player grandfathering tested
- [ ] D1 database created
- [ ] `progression-schema.sql` executed
- [ ] Separate progression Worker deployed
- [ ] D1 binding named `DB`
- [ ] Real Worker URL placed in `CONFIG.endpoint`
- [ ] Anonymous identity persistence tested
- [ ] Cloud sync tested
- [ ] Network-failure behavior tested
- [ ] Recovery creation tested
- [ ] Recovery restore tested
- [ ] Multi-device behavior clearly decided/documented
- [ ] Cloud merge rules implemented/tested
- [ ] Anti-cheat validation adequate for intended use
- [ ] Privacy page updated if needed
- [ ] Android Chrome tested
- [ ] iPhone Safari tested
- [ ] Desktop tested
- [ ] Existing stats Worker still works
- [ ] Normal Rook gameplay regression-tested
- [ ] Production backup created immediately before launch
- [ ] Feature switches enabled in controlled order
- [ ] `enabled:true` changed LAST

---

# 11. QUICK HANDOFF PROMPT FOR A FUTURE CHAT

If this work is resumed in another ChatGPT conversation, provide the newest game ZIP and say:

> This Griffin House of Rooks build contains the dormant progression system documented in `PROGRESSION_COMPLETE_SETUP_GUIDE.md`. Read that file and inspect the exact current source before changing anything. Start from this current working build, preserve the existing legacy stats system, make surgical changes only, and continue the activation checklist from the first unfinished step. Do not simply flip the master switch on. Package the next build with `index.html` first in the ZIP and keep the complete setup guide updated with every progression change.

---

# 12. CURRENT DORMANT STATE SUMMARY

At the time this guide was written:

- 50-level table: BUILT
- 25 five-tier families / 125 medals: BUILT
- 20 special feats: BUILT
- advanced-stat data model: BUILT
- anonymous player ID/device secret generator: BUILT, OFF
- local extra-stat storage: BUILT, OFF
- recovery-code generator: BUILT, OFF
- cloud API browser helpers: BUILT, OFF
- D1 schema: BUILT, NOT DEPLOYED BY THIS PACKAGE
- progression Worker template: BUILT, NOT DEPLOYED BY THIS PACKAGE
- live advanced-stat game hooks: NOT YET CONNECTED
- Career/Achievements visible UI: NOT YET CONNECTED
- cloud endpoint: BLANK
- cloud sync: OFF
- recovery: OFF
- notifications: OFF
- bot progression: OFF
- master progression system: OFF

This distinction matters: the framework is installed and documented, but activation still requires the integration/testing steps above.

---
# OFFLINE-FIRST + BOT STATS ADDENDUM (REQUIRED)
The progression design is now explicitly local-first. Humans and named bots must earn the same applicable career stats, levels and achievements with no internet connection. Every authoritative update is saved locally first and queued for later Cloudflare synchronization. Cloudflare must never be required to continue gameplay or progression. Local sorting/leaderboards must work without internet. See `OFFLINE_ONLINE_BOT_STATS_SETUP.md` for the exact data model, bot rules, reconnect behavior, deduplication warning, recovery merge rules, activation order and mandatory airplane-mode test.

---
## RookGame452 addition — read-only preview and celebrations
RookGame452 adds `PROGRESSION_PREVIEW_AND_CELEBRATIONS.md` and a read-only phone dry-run in `progression.js`. Before migration or activation, use that guide to inspect the actual device's `Jerome`/`Host` lifetime records and preview achievement/level animations. This does not alter the dormant master-switch state.

## ROOKGAME453 CAREER PROTECTION ADDENDUM
RookGame453 adds offline Career Backup/Restore and a friendly Recovery Code foundation. The authoritative local activation and protection checklist is `CAREER_PROTECTION_AND_ACTIVATION.md`. Follow it before enabling local progression. Cloudflare is not required for local progression; keep `cloudEnabled:false` until the Worker/database is separately tested.
