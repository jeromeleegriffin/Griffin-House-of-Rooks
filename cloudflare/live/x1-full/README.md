# Full online X1 — v2

Continue v1; native R10 remains unchanged. The frozen core, SHA and bidding engines retain their exact bytes. Standard normal play uses the original engine. A rule-aware sampled extension handles Moon and deck/ranking/scoring/nest variants, including every option currently accepted by the online game. Moon is compared using terminal win/failure utility, including negative scores and lost zero-point tricks. The extension's historical tournament strength is not established by functional correctness tests.

Sole-human/three-bot games now permit that human's partner bot to receive only its partner's current cards inside server-side sampling. Current authoritative roster/IDs/seats/teams are checked every decision. With two or more humans, all bots use own/public information. No opposing hand is read, no private card is added to snapshots, and no bidder's buried nest is shared with its partner. The approved own/public X1 bid takeover and Anchor partner-first route are carried over under the same sole-human eligibility boundary. Moon uses its own contract objective rather than the Anchor override.

The v1 memory version is retained for hands already in progress; v2 starts at the next deal. There is no settings, room, artwork, voice, audio, HTTP/DO security/pacing wrapper or service-worker reset. The native offline implementation is unchanged; this is the online server completion.

## Reproduction

Export cloudflare/live/worker-live.mjs and cloudflare/live/x1/bridge.mjs from immutable Test commit9b63d8d9791c7b8d7d9766aaae065c675e03d10b to separate temporary files. The base Worker SHA-256 must be313ed667456754003a054b6506c9c5579d98d16ecb179b9d8465fa954152e6c1. Run:

```sh
python cloudflare/live/x1-full/build.py --base /absolute/path/to/v1-worker.mjs --v1-bridge /absolute/path/to/v1-bridge.mjs --output cloudflare/live/worker-live.mjs
node cloudflare/live/x1-full/verify.mjs
node cloudflare/live/x1-full/reliability-unit.mjs
```

The build verifies its base and trailing bridge before applying scoped changes. Existing v1 build helpers are historical reproduction tools; do not use them to overwrite v2. Hosted QA uses only its own generated test rooms and a separate test namespace; the temporary test route must be disabled afterwards. See coordination/releases/full-online-x1-20261021/ for the final receipt, scopes and rollback.
