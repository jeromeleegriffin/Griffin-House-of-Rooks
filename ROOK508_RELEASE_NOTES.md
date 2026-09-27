# Rook 508 — Production bot portraits

Source starting point: main @ APP_VERSION 507 (`dd54a1e`).
This build is the next sequential version: **508**.

## What changed

- Installed the finished cinematic / semi-realistic **individual bot portrait PNGs** (`avatar-<bot>.webp`). One file per character. Not a contact sheet, not SVG redraws, not emoji placeholders.
- `avatarSrc()` now serves WebP portraits when a production file exists and still serves legacy SVG files for player-selectable animal avatars that do not have a cinematic portrait.
- First-wave house bots that previously reused animal SVGs (Crow, Blaze, Nix, Titan, Pike, Drift, Dice, Anchor, Wager, Hollow, Ember, Vex, Frost, Fang, Halo) now point at their own named portraits. Bot names, styles, blurbs, and AI were not changed.
- Jerome / human player avatar selection is unchanged: existing picks still resolve, and SVG fallbacks remain for ids without a PNG.
- Removed the maroon / brown rectangular plaque panels behind the **top and bottom** player seats. Circular portrait, name, rank badge, and money stay. Top and bottom now read like the side seats.
- Names stay horizontal (no stacked letters). Name / badge / money sit around the circular portrait without a box.
- Seat portraits are larger and use `clamp()` responsive sizing so they shrink before covering cards, the trick, nest, trump, bidding, score, Last 3, Message Table, or menus. Portrait and landscape use different caps.
- Service worker cache bumped to `house-of-rooks-v508`. All new WebP portraits and remaining SVG avatars are in the offline shell list.
- Visible / handshake version references updated to 508 (`APP_VERSION`, `hor-version.js`, `index.html` BUILD and `?v=` cache bust, `sw.js`).

## What did not change

- Rook rules, dealing, bidding, nest / top-nest reveal, trump selection
- Bot intelligence and personality styles
- Multiplayer / Peer behavior
- Scoring, achievements, statistics, career / progression
- Sounds (My Turn, bot seating, empty-seat) and card animations

This is an art + presentation update.
