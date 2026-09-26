# Rook 500 repo change

Built directly from user-supplied Rook499.

Changes:
- Preserves the Rook499 lobby layout exactly; no lobby CSS changes.
- Keeps Rook499's shortened 1.8-second top-nest-card reveal and synchronized reveal audio.
- Keeps Rook499's 19 selectable subtle My Turn tones.
- On the first hand only, My Turn audio is suppressed during bidding when Turn Over Top Nest Card is enabled.
- If Turn Over Top Nest Card is disabled, the first-hand My Turn cue plays normally.
- Restores the separate seating sound when a bot is added to a lobby seat.
- No speculative turn-detection changes.
- Version/cache markers bumped to 500.

Repo upload: replace the files in the repo root with the files in this package.
