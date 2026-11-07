# Rook laptop bottom-console horizontal movement audit
Date: 2026-11-07

## Verified deployed target
- Official game: `https://rooks.jeromegriffin.com/`
- Cloudflare custom domain mapping: `griffin-house-of-rooks-online` in production.
- Latest active Cloudflare deployment: `3e860d7b-9d2e-4402-804c-458371ea88cd`, created Nov 2, 2026; Worker v130 `4335d4fa-d2ef-4d1e-9bad-dda40e71ce1e` at 100%.
- This is the live Cloudflare game, not GitHub Pages or an older Workers preview.

## Reproduction / evidence
Used **Cloudflare Browser Rendering** on the official live URL `/cloud-game/index.html`, viewport 1366×768 and 1920×1080, safely starting **Play Offline** with an isolated synthetic visitor. No live room/player data touched.

The landscape bottom strip contains `.house-landscape-clock`, `#houseLandscapePace1023`, `.angle-c-player-name:first-child`, and `.house-landscape-goal`.
- At 1366×768, clock viewport width **100px**, but decorative walnut image intrinsic rendered width **about 454px** with a left offset; clock element's `scrollWidth=441px`, `clientWidth=98px`.
- Status/goal viewport width **112px** but `scrollWidth=123px`, `clientWidth=110px`.
- Both use `overflow: hidden`, which clips visually but **creates a programmatically scrollable container**. Setting `scrollLeft=100` on the clock successfully moves it by 100px, potentially shifting cropped artwork/time horizontally.
- When `overflow:clip !important` was applied to just these two console fields, setting `scrollLeft=100` left `scrollLeft=0` and the container's width and position remained **identical**. Repeated this at 1920×1080: baseline clock `scrollLeft=120` and status scrollLeft=13, patched both remained zero, with identical bounding rectangles.
- The overall document `scrollWidth` stayed equal to viewport width in both tested sizes. The bottom name, clock and speed elements themselves did not shift in a short 3-second stationary sample. Thus **the user-reported spontaneous side-to-side motion was not directly reproduced**, but an exploitable internal scrolling vulnerability was confirmed. Do not overclaim root cause without a laptop recording.

The landscape scene deliberately uses `Math.max(width/1844,height/853)` to fill/crop; at 1366×768 scene width 1660px and x=-147px, but the theater already clips it and document scrolling was not observed. No scene-camera change recommended.

## Minimal candidate fix (GitHub audit branch only)
Appended a narrowly scoped `@media (orientation:landscape) { @supports (overflow:clip) {...} }` rule to `house-premium-ui.css`:
```css
body.in-game .house-landscape-clock,
body.in-game .house-landscape-goal {
  overflow: clip !important;
}
```
This preserves decorative PNG crops, clock text, controls and game logic while preventing these console fields from becoming internal scrollers.

**Deployment status:** not live. Production Cloudflare Worker, static-asset version, bindings, game AI, rooms and career records unchanged. GitHub main also unchanged.

## Release gate
1. Obtain a 5-10 second clip from the affected laptop if horizontal movement persists; capture browser zoom and resolution, and whether whole strip or cropped artwork moves.
2. Confirm the *actual served Cloudflare CSS asset* matches or can safely receive the scoped rule; GitHub branch CSS alone does NOT deploy to live assets.
3. QA on Windows Chrome and Edge at 1366×768, 1536×864, 1920×1080; test browser zoom at 100%, 125%, and fullscreen, and check active bidding/play clocks, name plaque and speed interactions.
4. Deploy only with preserved original Cloudflare script/assets and rollback reference once verified.
