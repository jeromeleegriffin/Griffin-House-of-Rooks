# Rook 517 — Multiplayer / bug roll

Built from the verified Rook 516 authoritative package.

## Multiplayer repair
- Removed the legacy Rook513 MutationObserver/navigation lock that could fight the current screen state machine and leave Play With Friends apparently frozen.
- Removed the duplicate legacy Play With Friends onclick override; game.js is now the single owner of multiplayer navigation.
- Switched PeerJS setup to the supported PeerJS Cloud configuration instead of treating the public cloud as a custom/self-hosted broker.
- Removed unverified third-party TURN credentials and the mid-join forced-relay Peer recreation path that could orphan join callbacks.
- Added a 12-second host-room creation watchdog so a signaling failure can no longer leave the multiplayer button disabled forever.
- Join retries keep the healthy signaling Peer and retry the DataConnection instead of destroying/recreating the Peer mid-handshake.
- Existing version mismatch, reconnect, seat reclaim, connection wrapping, and host-authoritative game messaging are preserved.

## UI / bug cleanup
- Retired the visible table-money balances and Message Table purchase controls while leaving legacy accounting code intact for a safer later removal.
- Hid beer/private-message purchase options that depended on the retired table-money UI.
- Polished the portrait bid controls into a darker walnut/brass physical table console without reducing tap targets.

## Version/cache
- App/build/cache references advanced from 516 to 517.

## Validation boundary
Static/syntax/package validation was performed. A real two-device WebRTC connection cannot be proven inside the build environment, so multiplayer must be smoke-tested on two devices before it is called confirmed-good.
