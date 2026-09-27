# Rook510 — production portraits

Bump from the 508 portrait drop to the requested live version **510**.

- APP_VERSION / BUILD / cache-bust `?v=` / service-worker cache `house-of-rooks-v510`
- Cinematic WebP portraits for all BOT_PERSONAS (512×512 face crop)
- `avatarSrc` prefers `avatar-<id>.webp`, remaps old animal IDs (raven→crow, fox→blaze, …)
- Top/bottom maroon rectangular name plaques removed; names stay horizontal
- Large circular portraits preserved (clamp 2.35–4.2rem, object-position 50% 16%)
- Offline SW caches every `avatar-*.webp` plus the 510 boot/CSS overlay
- No gameplay, bidding, AI, or rules changes

Boot files: `rook510-avatars.js`, `rook510.css`
