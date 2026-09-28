# Rook529 — SOL Tool Repair + Table Cleanup

- Fixed SOL developer activation in actual offline practice (`roomCode` is `OFFLINE`, so Rook528's empty-room check could never unlock it reliably).
- Added an obvious SOL Studio launcher directly on the in-game toolbar for SOL offline play.
- Added one-tap Bottom / Top / Left / Right avatar selectors inside SOL Visual Studio.
- Picking an image inside an avatar now promotes selection to the avatar container, so movement/resizing affects the intended avatar.
- Preserved typed X/Y/W/H/scale/font/Z controls, drag, keyboard nudge, lock/hide, undo/redo, portrait/landscape overrides and export.
- Retired Message Table from player-facing UI and removed the local composer trigger/wiring while retaining legacy receive compatibility.
- Trump stamp now carries RED / BLACK / GREEN / YELLOW directly on the physical stamp.
- Removed GH from the trump stamp.
- Removed the separate permanent trump label/badge while trump is active.
- Stamp dimensions/landing position remain fixed; YELLOW uses tighter typography and can use its own contrast treatment.
- More menu opens away from the central felt.
- Core rules, shuffle, deal, scoring and multiplayer protocol were not intentionally changed.
