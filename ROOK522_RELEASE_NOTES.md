# Rook522 — Refresh Loop Root-Cause Fix

- Unified runtime APP_VERSION with the deployed asset/build version (522).
- Removed the automatic same-host version checker that could call Force Refresh repeatedly.
- Permanently retired Experimental `cacheRefresh` and sanitizes any old saved setting.
- Removed the 1.2-second service-worker update hammer from both polish layers.
- Repaired PWA manifest start_url so it no longer launches with stale `v=493`.
- Preserved the manual Force Refresh escape hatch, service-worker offline fallback, gameplay, networking, and banked visual work.
