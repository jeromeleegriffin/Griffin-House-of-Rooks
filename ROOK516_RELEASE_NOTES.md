# Rook516 — cumulative visual polish roll

Built from the protected Rook514 line while retaining the surgical Rook515 box/PeerJS fixes.

## Visual / UX
- Player portraits are still by default; only the current/actively-thinking seat gets a restrained slow movement.
- Portrait avatars are enlarged modestly and pushed outward without changing table/card geometry.
- Bottom-seat human avatar is now explicitly selectable and persisted in local storage; selection is carried in multiplayer join/avatar messages.
- Jerome portrait is included as a selectable avatar.
- Center-table TRICK/status caption is removed; trick cards and logic are unchanged.
- Hand rack receives a shallow walnut/brass physical lip; card bottoms sit a few pixels deeper and cards get tiny deterministic alignment variation.
- Landscape felt is darkened/refined while preserving the large-card accessibility purpose.
- Landscape hand/history cards get restrained physical variation without reducing card size.
- Generic modal/popup chrome is unified toward dark walnut/black + restrained brass.
- Special-capture celebrations are smaller and less intrusive while still celebratory.
- Achievement/progression toasts are smaller, shorter, and less webpage-like.
- Blue-bird emoji Rook markers are removed from the visible UI and replaced with black-bird artwork/text markers.

## Protected / carried forward
- Rook515 live-seat box source fix retained.
- Rook515 redundant PeerJS loading fix retained.
- Rook514 room background retained after direct asset inspection; no replacement was justified.
- Card face sizes/readability, rules, AI, scoring, dealing, trick history capacity, and table geometry were not intentionally changed.

## Validation
- Static JS syntax checks.
- Service-worker referenced-file existence check.
- Version/cache consistency scan.
- ZIP integrity check.
- Runtime phone/browser visual QA still required before promoting this build to authoritative current.
