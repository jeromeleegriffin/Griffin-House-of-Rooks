# Build 846 source cleanup

Continues the exact recovered and deployed Build 845. The owner requested a professional cleanup of the full codebase and removal of the experimental build caption from live landscape mode. This checkpoint is locally verified and is not itself a deployment.

## Changes

- Removed the landscape review notice node, updater and CSS, rather than hiding the old 840 caption. Diagnostic runtime identity remains available to support tools.
- Removed the unused shuffle732 JS/CSS and empty landscape hand adapter, including its caller and precache entry. Preserved the approved signature shuffle and its recordings.
- Removed retired coach advice, unreachable turn-banner branches, an empty lobby IIFE, two unused local helpers and 36 unused bindings. Removed stale chooser page/collection bookkeeping, unused audio handles and obsolete fire/audio reads. Legacy storage and network setting fields remain for compatibility.
- Removed 19 exact duplicate CSS rules and two exact duplicate declarations, preserving cascade order, conditional ancestry and different fallback values.
- Formatted 61 maintained root JS files plus CSS and HTML. JavaScript formatting passed normalized AST comparisons, allowing equivalent logical association and removal of empty statements. Frozen strategy/rules and vendor files are byte-identical.
- Moved 14 exact PCM recordings from application logic to two synchronously loaded data assets. Original sample bytes and scheduling are unchanged. Replaced a 1.6 MB duplicate base64 PNG with the exact existing approved bid-dock PNG, now explicitly preloaded, decoded and precached.
- Consolidated the worker inventory from 1469 entries to 1449 unique current paths, removing 22 historical duplicate aliases and the retired adapter while adding three required dependencies. Reuse is restricted to unchanged previous-release artwork; no user cache or saved data is deleted.
- Preserved 29 inherited review notes unchanged under docs/history/build-845-inherited. Added a current README, developer guide, pinned development tools, formatting rules, source checks and CI.

## Evidence

See CANDIDATE_RECEIPT.json for all counts and test limits; SOURCE_MANIFEST.json is the exact current source inventory. Every one of the 1464 original asset/voice paths is byte-identical. All protected strategy/rules/vendor files match the baseline.

Two full native matches completed, one per orientation, with four hands each. The separate native hand/rotation suite passed 13 checks. Settings, all 48 menu routes, avatars/search, audio, scoring, network privacy/reconnect, stale action guards and trusted host transfer passed. Five frozen visible-layout comparisons match. Fresh offline reload/QR and an actual 845-to-846 worker upgrade with synthetic saved careers and preferences passed; the old cache remains. No page errors or missing assets were recorded in final scenarios.

The first two menu routes timed out under ten simultaneous test browsers because the harness assumed a fixed startup delay. Both passed after waiting for the actual loader. The avatar harness was corrected to use the actual 66 identities and the existing close-on-rotation behavior. Original menu evidence and the focused retry are retained.

Physical Android acceptance, subjective listening and real WAN multiplayer are not certified by these tests. No game ZIP was created. This cleanup does not change strategy, game rules, scoring, roster policy, approved art or physical-table geometry. It does not claim that every dynamically referenced code path is now provably unreachable or that a monolithic classic-script architecture has been rewritten.

## Release procedure

Read current main heads and the 846 reservation. Preserve rollback refs from those exact heads. Verify both candidate trees against the complete source manifest and inspect deleted paths. Publish Test with an expected-head lease; require source CI and Pages success, source HTTP hashes and live browser checks. Only then publish the same checked runtime to production with its own expected-head lease and verification. Update the Master Brain, registry, release receipt and handoff with the actual commits and outcomes. Do not force-reset history or clear player data.
