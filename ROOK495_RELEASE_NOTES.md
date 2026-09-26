# Rook495 Release Notes

Base: Rook494.zip (SHA-256 ef8bd195a06ce0a6dff8a047afd7a012c0c6d793985f98ec7d134909cb38b777)

## Multiplayer waiting-room seat consistency
- Replaced remaining waiting-room/start-button uses of raw `players.length` with authoritative `seatedCount()` where the UI is describing occupied chairs.
- A connected human with `seat: -1` no longer inflates the displayed seated count.
- A connected-but-standing human no longer enables the initial host Start button.
- Preserves Rook494 safer no-service/net-retry behavior; no unrelated gameplay changes were made.

## Validation performed
- Node syntax check: game.js passed.
- Node syntax check: bots.js passed.
- Package integrity and version/service-worker checks performed during packaging.

## Real-device status
- NOT yet phone-to-phone tested. Jerome should test Careers OFF/OFF first, then mixed Career settings.
