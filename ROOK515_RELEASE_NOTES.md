# Rook515 — Boxes + Play With Friends surgical roll

- Removed the surviving live-table team boxes at their source: `paintNamePlaque()` was writing inline `!important` team backgrounds that overrode Rook514 CSS.
- Preserved team metadata and waiting-room team styling.
- Added a portrait live-seat guard so no old seat/name pseudo layer can recreate the rectangular plaque.
- Removed the guaranteed request to nonexistent `vendor/peerjs.min.js`.
- PeerJS now tries jsDelivr then unpkg, plus host/join have an on-demand redundant loader instead of immediately failing when `Peer` is unavailable.
- Preserved the existing host waiting-room, room codes, reconnect, broker retry, ICE/STUN/TURN and gameplay transport.
- Protected Rook514 background, table geometry, card layout/sizing, avatar placement, AI, scoring, dealing and rules.
- Advanced active app/service-worker references to 515.
