# Rook521 — Refresh Loop Kill

Emergency surgical update based on Rook520.

- Removed the page-level build-mismatch cache purge + forced redirect.
- Removed automatic reload on service-worker `controllerchange`.
- Service worker remains network-first for HTML/JS/CSS with offline cache fallback.
- Service worker still activates immediately and claims clients, but no longer forces the running page to reload.
- Build/cache markers bumped to 521.
- Corrected the live version beacon build marker to 521.
- No gameplay, multiplayer, table visual, avatar, Trump-stamp, scoring, bidding, or achievement changes.
- The larger visual-review ideas remain banked for the later video review.
