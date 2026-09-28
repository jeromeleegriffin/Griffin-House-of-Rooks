# Rook538 Release Notes

## Layout checkpoint recovery
- Restores the latest authoritative portrait SOL coordinate checkpoint from Rook531 as the active starting layout.
- Starts a fresh SOL layout-storage generation (V7) so later 532-537 experimental phone-box / Quick Move coordinates cannot override the recovered checkpoint.
- Preserves the current Rook537 gameplay code, including the Rook536 Friends re-entry cleanup and duplicate-avatar table protection.
- This is a coordinate recovery only; it does not roll gameplay back to Rook531.

## Authoritative portrait anchors restored
- Bid dock: x 29, y 47, scale .85
- Bottom avatar: x 27, y -15, scale 1.4
- Bottom name: x 12, y -23, scale 1.2
- Right avatar: x -24, y -21, scale 1.2
- Right name: x 19, y -6
- Bot Thinking: x 24, y -50, scale 1.04
- Trick area: x 14, y -109

No browser-data clearing is required for this checkpoint recovery.
