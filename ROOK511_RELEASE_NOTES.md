# Rook511 — seat + portrait production overhaul

Starting point on GitHub main was still APP_VERSION 507; 508/510 were overlay/beacon-only. This build wires portraits and seat chrome into the actual game files.

- APP_VERSION / BUILD / SW cache `house-of-rooks-v511`
- Cinematic WebP portraits for bots and humans; selector shows modern faces only
- `avatarSrc` resolves known IDs only; legacy animal IDs migrate (raven→crow, fox→blaze, …)
- `jerome` → `avatar-jerome.png` when that file is present
- Avatar persisted in horPrefs and sent on join / avatar messages
- Top/bottom rectangular plaques removed as visual panels; wrappers kept for JS
- Independent portrait vs name/money/badge layers; larger outward-growing seats
- pointer-events:none on decorative portraits
- No rules / AI / scoring / networking protocol changes beyond avatar identity on join
