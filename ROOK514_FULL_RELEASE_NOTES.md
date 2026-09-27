# Rook514 — Full Authoritative Release

Built from the complete Rook513_FINAL baseline plus the approved Rook514 visual roll.

## Rook514
- Integrates the purpose-built Griffin House portrait room background.
- Integrates the Jerome selectable portrait and modern human fallback behavior.
- Removes old portrait seat chrome and enlarges/repositions portraits without resizing the table.
- Adds the premium information-first landscape tabletop polish.
- Preserves the proven Rook513 behavior guard and core game mechanics.
- Synchronizes visible build, APP_VERSION, live-version beacon, cache-busting and service-worker cache to 514.
- Adds the Rook514 visual assets to the offline shell.
- Removes stale references to the absent rook512.css and absent local PeerJS vendor file from the service-worker shell so one missing file cannot abort shell precaching. The existing browser PeerJS CDN fallback remains unchanged.
- HOR_BUILD remains 497 intentionally; its separate build semantics were not changed.

## Verification
Static release checks passed: required files, version coherence, JavaScript syntax, local index references (excluding the intentional PeerJS CDN fallback path), service-worker shell file existence, Rook514 bridge/assets, and preservation of the Rook513 behavior layer.

Rendered browser/gameplay QA is still required after deployment.
