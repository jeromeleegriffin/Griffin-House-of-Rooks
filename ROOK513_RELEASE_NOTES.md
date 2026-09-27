# Rook513 — cumulative production roll

Built from the verified GitHub main/512 state.

Included:
- Preserve the successful approved `room-card-club.jpg` background fix.
- Remove legacy generated room decor over the approved room.
- Reframe the existing room in portrait so more of its baked-in upper lighting is visible without resizing the table.
- Remove legacy top/bottom seat/plaque chrome.
- Force avatar wrappers and images to true circles.
- Enlarge portraits substantially.
- Move left/right portraits outward so they visually straddle the gold rail.
- Keep names and bank text independent of portrait dimensions.
- Keep center trick, nest, messages, action panel and hand above decorative portrait layers.
- Fix Play with Friends so it explicitly exits Join-with-code state and starts the real host/createRoom flow.
- Join with a code remains the only button that opens the join form.
- No table geometry, game rules, AI, scoring, dealing, sounds, or card mechanics intentionally changed.

Deployment:
Upload/replace the files in this ZIP at repository root. `index.html` is included and loads `rook513.css` and `rook513.js` after the existing 512 layers, and bumps cache-busting to 513. `sw.js` and `hor-version.js` are bumped to 513.

Important:
`game.js` remains the current engine and is NOT replaced by this roll.
