# Rook 508 — Production bot portraits

Source starting point: main @ APP_VERSION 507 (`dd54a1e`).
This build is the next sequential version: **508**.

## What changed

- Installed the finished cinematic / semi-realistic individual bot portraits (`avatar-<bot>.webp`). One file per character.
- `avatarSrc()` serves WebP portraits when a production file exists and still serves legacy SVG files for player-selectable animal avatars.
- First-wave house bots that previously reused animal SVGs now point at their own named portraits. Bot names, styles, blurbs, and AI were not changed.
- Human player avatar selection is unchanged; SVG fallbacks remain for ids without a cinematic portrait.
- Removed the maroon / brown rectangular plaque panels behind the top and bottom player seats.
- Names stay horizontal. Name / badge / money sit around the circular portrait without a box.
- Seat portraits use clamp() responsive sizing so they shrink before covering play.
- Service worker cache bumped to house-of-rooks-v508. New portraits are in the offline shell list.
- Version references updated to 508.

## What did not change

- Rook rules, dealing, bidding, nest / top-nest reveal, trump selection
- Bot intelligence and personality styles
- Multiplayer / Peer behavior
- Scoring, achievements, statistics, career / progression
- Sounds and card animations

This is an art + presentation update.
