# Rook530 — SOL Studio 2 / Stable Layout Roll

- Removed SOL Studio continuous geometry reapply polling that could fight live game layout.
- Saved layout is applied once on load; edits affect only the selected element while editing.
- Studio panel can be dragged by its title bar, docked left/right/top/bottom, collapsed, and remembers position separately in portrait/landscape.
- PICK ANYTHING can select live table/UI elements, with SELECT PARENT for moving a containing box.
- Added quick selectors for all four avatars and all four player names, plus bid/trump/nest/Last 3 helpers.
- Added +/- size controls while retaining exact X/Y/W/H/scale/font/Z fields, hide, lock, reset, undo/redo and export.
- LOCK protects a candidate layout; FINALIZE / EXPORT prepares values for later production-code promotion.
- Fixed Trump stamp word fitting without changing the approved stamp size or landing position. RED, BLACK, GREEN and YELLOW have fixed fit typography.
- Rook529 Message Table removal remains intact.
- Core rules, shuffle, dealing, scoring and multiplayer protocol were not intentionally changed.

## Continuity
See `GRIFFIN_HOUSE_SOL_LAYOUT_KNOWN_ISSUES.md` and `ROOK530_PORTRAIT_LAYOUT_EXPORT.json` in subsequent builds for authoritative SOL/table findings and the preserved portrait layout.
