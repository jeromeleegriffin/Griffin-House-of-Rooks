# Rook519 — Play With Friends Forensic Repair

Dedicated networking-only repair.

## Basis
- Current production base: Rook518.
- Known-good reference supplied by Jerome: RookGame386.zip.
- Compared the host creation, guest join, PeerJS signaling, DataConnection retry, transport wrapper, reconnect, and lobby ownership paths.

## Root regression found
The Rook517-era create/join lifecycle had diverged from the known-good path. It added a host-creation busy/watchdog state, dynamic PeerJS loader recursion, offline-stop state, and—most importantly—changed the guest retry path so it no longer rebuilt the Peer with relay ICE after repeated DataConnection failures. The core transport wrapper itself remained substantially aligned with 386.

## Repair
- Restored the known-good 386 createRoom/joinRoom lifecycle as the authoritative networking path.
- Restored the proven retry/relay behavior, including Peer recreation at the relay transition.
- Preserved current Rook518 avatar identity payloads and public career metadata.
- Preserved all current game-state message handlers, rules, visuals, Trump medallion, table, cards, achievements, and progression code.
- Kept the Rook517 compatibility guard that prevents the obsolete Rook513 MutationObserver from stealing lobby/game navigation ownership.
- Bumped multiplayer protocol/app version and cache shell to 519 so stale clients are rejected/refreshed instead of silently mixing network generations.

## Validation
- Static JavaScript syntax validation passed.
- Package integrity verified.
- Final proof still requires a real two-device host/join test; static analysis cannot certify WebRTC connectivity.
