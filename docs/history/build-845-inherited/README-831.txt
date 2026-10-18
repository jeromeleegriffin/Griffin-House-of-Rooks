831 — LANDSCAPE ROOM FIT

Continue from 830.zip (SHA256 a6181ca12cbfd41e58aac42031566d802a6857d1d6673e465df3da0b302d0777). Isolated playable ZIP; serve index.html or load through the existing ZIP player. No live sites, repositories, existing saves or caches were changed.

Owner-directed changes:
- Visible Full screen / Exit full screen button on landscape entrance and waiting room, plus an entry on the shared menu. Requests actual browser fullscreen from the tap. Failure is shown honestly on the button. Works before starting a game; manual exit stays respected.
- Entrance partner name and Change Partner share one row. Welcome and Edit player form a stack with guaranteed clearance above the play dock at tested short landscape heights.
- Empty seat selectors raised to the future player positions; partner centered slightly higher. One boundary per selector; no nested double borders.
- Waiting-room seating count separated from the local player's plaque. Sharing controls, primary next step and Leave Table remain in the bottom dock. Fill seats is the primary action until the table fills, then Start Game replaces it for the host. Existing native actions retained.
- Shared main menu uses two columns in landscape and paginates by visual rows. Short landscape shows four choices per page (three pages), taller landscape shows all public choices on one page. No scrolling added. Existing profile, career, sound, rules, setup and safe leave routes retained.
- Fullscreen icon uses a vector corner outline to avoid missing-font glyphs.

Validation:
- Visual and measured entrance / empty / filled waiting room checks at844x245,844x273,844x390,1280x720. Portrait390x844 checked.
- Measured control gaps and seat bounds pass at all four landscape sizes.
- All public main-menu actions reachable through pagination. Native fullscreen entry/exit from entrance, menu and waiting-room controls passed.
- Fullscreen also tested inside an allowfullscreen iframe (matching ZIP-player embedding): outer fullscreen element becomes IFRAME and exits normally.
- Name edit, partner photograph selection/save, Join by Code, bot replacement cancellation, name-to-stats, Fill seats, and native Start Game tested. Start enters the actual dealing phase.
- Portrait rotation restores partner control to its original parent without document overflow.
- Fresh service-worker installation and offline reload return coherent831 page/script/worker versions and the new controls/styles.
- No page script errors in final checks.

Limits:
Network multiplayer was not tested. Waiting-room signaling was isolated in a local fixture; actual application seat and start handlers were used. This pass does not claim a full-game replay on the handset. Fullscreen depends on browser/embedding permission; unsupported requests report unavailable instead of pretending to enter fullscreen.

830 dealing, reveal option, sound triggers, lantern asset and game geometry are preserved. No new imagery, bid-box changes, AI or scoring changes. The only game060.js behavior change is honoring explicit fullscreen choice. All earlier README/checkpoints remain historical; this README and REVIEW-CHECKS.json describe831.

Continuation:
Current-session verified remote Brain wasAE. This831 candidate derives from830, not an805 rollback. No remote Brain edits. Preserve both permanent continuity rules verbatim in review-continuity. Read the current remote brain/current.json before any future repository work.
