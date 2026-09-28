# Rook520 — Play With Friends signaling + clean Leave repair

Built from Rook519. Dedicated multiplayer-only follow-up based on the real two-device failure recording.

## Host discovery repair
- Restored the explicit `0.peerjs.com:443` signaling endpoint used by the known-good Rook386 path.
- Restored the known-good local `vendor/peerjs.min.js` runtime from Rook386, with CDN fallback only if the local asset fails.
- Preserved current Rook519 game messages, avatar/career sync, UI, Rook518 Trump work, and current game logic.
- Kept current conservative STUN configuration; no unverified third-party TURN credentials were reintroduced.

## Intentional Leave repair
- Intentional Leave now marks teardown before PeerJS connections are closed.
- Saved room session is cleared both before and after teardown.
- Rejoin/Reconnect controls are hidden immediately on intentional Leave.
- Fresh lobby only shows Rejoin when a valid saved multiplayer room actually exists.
- Offline sessions never qualify for Rejoin.

## Validation
- JavaScript syntax checks passed.
- Version/cache references advanced to 520.
- Rook518 Trump assets remain present.
- Final verdict still requires a real two-device host/join test.
