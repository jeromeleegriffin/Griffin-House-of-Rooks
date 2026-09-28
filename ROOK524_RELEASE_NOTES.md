# Rook524 — Recorded Play Refinement Roll

Built from Rook523 candidate after reviewing the live screenshots/recordings and applying the three-pass critique/refinement process.

## Included
- Removed the permanent Message Table $100 control from normal table UI while leaving messaging plumbing intact.
- Fixed the recorded human-turn table pull by taking the changing message lane out of the vertical flex stack.
- Rebuilt the More-controls popover spacing so labels cannot collapse into one another.
- Locked player identity into a portrait + protected name/level unit, with ellipsis for long names.
- Applied a controlled avatar size bump after locking name/level geometry.
- Moved the approved trump medallion away from the player identity area to a table-relative upper-right felt position.
- Increased BLACK/GREEN/RED/YELLOW TRUMP label legibility without redesigning the medallion.
- Added minor enamel/brass 3D polish to Choose Trump buttons without changing their clarity or behavior.
- Human persona watcher now uses a neutral `House Player` placeholder before enough evidence exists; it does not reveal that analysis is underway.
- Increased persona evidence threshold to 12 hands and removed the old `New player / not enough hands` leak.
- Player Career card now carries Persona information when available.
- A visible career star no longer intentionally resolves to a dead interaction; persona info is used as fallback.

## Deliberately not changed
- Core Rook rules, shuffle/deal, scoring, card legality, bot decision engine, and multiplayer protocol.
- Rook522 refresh-loop safety strategy.
- The approved physical trump-medallion art direction itself.

Rook522 remains the last user-confirmed stable baseline until a newer build is personally verified.
