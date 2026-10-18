840 — Stable discard slots and installed-app launch test

Continues exact delivered839.zip (SHA256 511d7f549a48a45ba62c271f795af6a39d3d390a7e48dd925f41b3f8c447f555). No deployment. Open index.html in the existing ZIP player or through an HTTP server. All physical artwork, audio, bird reveal/fight effects, game rules, AI and network paths retained.

STABLE DISCARD SELECTION
After Kitty Received / Continue, all16 cards begin in the owner's existing sorted order in two fixed rows of eight slots. Discards one through five leave empty outlined slots. Every untouched card retains exactly its previous position and size; the remaining cards do not close gaps or grow. Tapping a discarded card returns it to its original slot. Deliberate sideways dragging still arranges cards. After the sixth discard, all ten retained cards come together in one row for final arranging and Lock hand & confirm. Returning a discard at that point restores the sixteen-slot view and original spaces; the final six selected cards remain shared with portrait during rotation. Reset restores the default order and clears selection. Native six-card confirmation, rejection/ack, exact chosen order and current-hand persistence remain unchanged.

CONTROLS
Removed the extra gameplay Full Screen button. Bottom right has Menu and Leave, with pace controls above. Full Screen / Exit full screen remains inside Menu in the browser, accessible during bidding. The welcome/waiting-page fullscreen controls were not removed by this scoped request. All839 rotation/draft fixes and scrollable partner/bot/avatar lists with Previous/Next remain.

INSTALLED-APP TEST
The existing installable manifest now requests fullscreen launch, with standalone fallback, preserving the same app id, scope, start URL, orientation and icon assets. This launches through the installed window rather than calling browser requestFullscreen on startup. The existing Menu > Install on This Phone and browser install instructions remain. In an installed fullscreen window redundant fullscreen controls are hidden; browser fullscreen still retains its Exit full screen menu action.

To test actual installation, this version must be served from the game's stable HTTPS address and installed/opened from its home-screen icon. A ZIP preview alone does not certify installation of the game itself. No hosted site was changed by this ZIP request. Browser fullscreen warnings cannot be suppressed by game code; Android installation/launch and the absence of that exact notice remain owner-device tests. Existing installed copies may need their platform to refresh the manifest. Do not clear game data or uninstall solely for this test without preserving progress.

CHECKS
See REVIEW-CHECKS.json:55 native checks include bid rotation, menu accessibility, Kitty Received in both orientations, two rows across five landscape sizes, actual touch discard/second-row insertion, exact positions/sizes through the first five discards at844x390,844x273,844x245,640x360, return to original slot, ten-card compaction, portrait selection retention, native submit/trump and one full hand to score. Install checks cover Chromium manifest parsing, fullscreen/standalone fallback and preserved identity, existing install-menu prompt flow without browser fullscreen, redundant installed controls and retained browser exit action. Offline active-worker reload checks verify840 coherence, manifest settings and prior bird assets.

Limits: no certification of physical Android installed launch/fullscreen notice/performance/audio, real network multiplayer, every rare rules combination or two new full matches. Prior837 portrait-host/landscape-guest fight duration limitation remains unverified. Stable slots are landscape selection presentation; portrait keeps its approved selection layout.

AUTHORITY / CONTINUITY
GitHub brain/current.json rechecked: AE unchanged; retained complete foundational/history reading from this continuous workstream. Older published runtime is not a rollback instruction for approved839. No Master Brain/repository mutation or deployment performed. Both permanent rules remain verbatim in review-continuity/CHAT_CONTINUITY_RULE.md and COMPLETE_BANK_READING_RULE.md. Every future handoff AND startup prompt must reproduce BOTH full rules verbatim and explicitly require each successor to pass those obligations to every following assistant.
