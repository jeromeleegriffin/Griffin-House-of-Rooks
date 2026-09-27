Rook513 — mobile approved-room visibility fix

Confirmed root causes in current GitHub 512 source:
1. style.css applies an opaque `body.room-theme-midnight .game-room` background with `!important`.
   That selector outranks Rook512's generic transparency rule, hiding room-card-club.jpg on the phone.
2. index.html still contains the legacy `.room-decor` DOM with `.sconce`, `.wall-frame`, and
   `.chandelier`. Rook512 tried to hide different class names, so the old sconces remained visible.

This patch:
- clears only the in-game legacy game-room background
- removes only the legacy generated room-decor layer
- preserves room-card-club.jpg and the existing Rook512 room injector
- does NOT resize/reposition the table
- does NOT change rules, AI, scoring, multiplayer, cards, bidding, or game logic

Integration:
- load rook513.css after rook512.css
- load rook513-room-fix.js after rook512-room.js
- bump cache/version references to 513 when integrating
