# Rook laptop console fix: LIVE Cloudflare deployment receipt
Date: 2026-11-07

**Production deployment succeeded.** Live custom hostname `https://rooks.jeromegriffin.com/` remains routed to `griffin-house-of-rooks-online`.

- New live Worker version: `e8d0abbf-67cf-424c-b771-9ef2046d0c95` at 100%.
- New deployment ID: `231e72b4-6297-42f8-9e49-ac84e6e2fcc4`.
- Original live version for rollback: `4335d4fa-d2ef-4d1e-9bad-dda40e71ce1e`.
- Original deployment ID: `3e860d7b-9d2e-4402-804c-458371ea88cd`.
- Used real combined entry module `cards-entry.mjs`, retaining Rook + Spades Durable Object exports.
- Uploaded same **30 module files**, changing only `delivery-assets.mjs` to serve the original static `/cloud-game/assets/house-premium-ui.css` with a narrowly scoped appended `@media(orientation:landscape) ... overflow:clip` rule for `.house-landscape-clock` and `.house-landscape-goal`. The original static asset was not overwritten; Worker response header `x-ghr-console-fix: 20261107`, cache-control no-store.
- No game AI, play rules, room persistence, worker bindings, or other module source changed. This live update is a **Worker CSS response patch**, not a direct deployment of the GitHub `house-premium-ui.css` file.

Cloudflare rejected two preliminary upload attempts before activation because of a multipart delimiter and an incorrect entry module; both rejected uploads left old v130 live. The corrected bundle with `cards-entry.mjs` main passed validation and auto-deployed.

## Live browser QA
- Browser renderer loaded actual live Rook offline game at **1366×768**. Both areas computed `overflow-x: clip`, set `scrollLeft=100` returned **0**, and document width remained 1366.
- Repeated at **1920×1080**: both computed `overflow-x: clip`, forced `scrollLeft=120` returned **0**, document width remained 1920.
- Spades URL `/spades/` still loaded Spades HTML successfully and was not given the Rook-specific console marker.
- Important caveat: this verifies internal scrolling is prevented. The spontaneous laptop movement reported by the owner was not reproduced before update; more gameplay/rematch coverage may be needed if the problem recurs.

**Rollback:** deploy the prior Worker version `4335d4fa-d2ef-4d1e-9bad-dda40e71ce1e`. The original static CSS and all 30 original modules are still available in the prior Worker version.
