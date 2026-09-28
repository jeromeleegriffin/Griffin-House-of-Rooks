# Rook534 — SOL Phone Design Repair

- Starts a fresh SOL V5 layout store seeded from Jerome’s latest approved portrait checkpoint.
- Removes Rook533 automatic screen-edge relocation. Off-screen state is warning-only.
- Adds S24 PORTRAIT DESIGN reference mode and forces game logic that asks `isLandscapeNow()` to remain portrait while the mode is active.
- Adds eight direct resize handles around the selected SOL object. X/Y/W/H fields remain available for exact numeric entry.
- Keeps LOCK (editing protection) separate from FREEZE (diagnostic position hold).
- Adds narrow-screen side-name bounding without moving the seat.
- Retains Rook532 discard/trump cleanup and prior core gameplay.
- The exact approved fighting-birds landing artwork is NOT substituted with another image: the approved source asset is not present in this source tree, so integration remains pending rather than silently using the wrong art.

Core rules/scoring/deal/shuffle/multiplayer were not intentionally changed in this roll.
