# Rook497 release notes

Surgical Reveal Top Nest regression repair from Rook496.

- Keeps exactly one authoritative top-nest reveal face.
- The stationary revealed face cannot replace the animated face merely because the auction has opened.
- Reveal stage now remains in the animated state for the full 2.8-second CSS reveal duration.
- Final face state occurs at 2.8 seconds; auction opens just after at 2.88 seconds.
- Existing reveal audio sequence remains tied to the same reveal start, so its 2.42-second landing sound now occurs while the card is visibly landing rather than after the visual has already finished.
- Preserves Rook495 multiplayer seating repair and Rook496 single-tap Your Turn sound.
