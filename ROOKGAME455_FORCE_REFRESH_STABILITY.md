# RookGame455 — Force Refresh Stability

- Force Refresh now preserves meaningful URL parameters, especially `?room=XXXX`.
- Cache-busting `fresh` and `v` parameters are replaced normally.
- The current viewport/scroll position is saved in sessionStorage immediately before refresh and restored after the new page lays out.
- Existing lifetime stats/localStorage are not cleared by this change.
- Service-worker/cache clearing behavior remains unchanged.
