835 — Navigation repairs and readable house plaque

Based on the delivered 834.zip, SHA256 62ac7751cdb759dc5178bdd89cbb744e5b4ab2db4336696da3e203debb14cf90. Isolated playable review candidate. No deployment, remote repository changes, player-data clearing or cache clearing. Previously verified Master Brain AE remains the inherited authority.

Approved scope: audit items 1–4 plus Griffin emblem/wordmark readability. Audit items 5–10 remain deferred.

1. Landscape History opens the native history renderer instead of dismissing the scoreboard with nothing shown. Back to Scoreboard and Escape preserve the same results and Next Hand action. History layout is bounded in landscape.
2. Explicit bot selection never silently seats a substitute. Occupied portraits are disabled with the seated owner's name; a late collision rejects the choice. Cancel preserves the prior bot. Favorite Partner uses consistent unavailable feedback and blocks confirmation of a stale conflicting favorite; valid choices retain the existing native storage path. Automatic random/fill-seat fallback remains unchanged.
3. House Tour uses a bounded viewport card. Got it and Skip tour remain reachable in short landscape and portrait, including rotation.
4. Short-landscape scoreboard has explicit rows and bounded disclosure summaries. Nest and Hand details open individually with Back, keeping the action row available. The existing scoring narrator now updates the single approved explanation in either orientation instead of adding a duplicate paragraph that displaced the grid.
5. Finished Griffin plaque replaces the low-contrast floating wordmark. Landscape welcome and waiting layouts group it with the central live content on the felt, away from faces, names and the lantern; portrait welcome uses the same readable asset. See 835-ASSET-NOTES.txt for construction and prompt.

Validation: native auction, six-card discard, trump confirmation, complete hand, scoring and Next Hand. Scoreboard and both disclosure controls plus History/return tested at 844x245, 844x273, 844x390, 1280x720 and portrait 390x844. Tour dismissal and rotation, occupied portrait choices, exact valid choice, replacement cancel and late-collision guard exercised. Fresh offline reload reports coherent 835 page/script/marker/worker and loads the plaque. Browser screenshots visually reviewed. Current REVIEW-CHECKS.json distinguishes native gameplay checks from controlled history/seat fixtures.

Limits: this repair pass did not repeat two entire matches, real network multiplayer, physical handset audio or every deferred audit route. The earlier 834 audit's two full matches remain historical, not a claim about 835. Owner handset appearance still needs review. Existing 833 trump-presentation timing and 834 bid anchoring, speed controls and shelf lantern are retained.

Preserve review-continuity/CHAT_CONTINUITY_RULE.md and COMPLETE_BANK_READING_RULE.md verbatim. Every future handoff and startup prompt must reproduce both complete rules and pass that obligation onward. Historical README/checkpoint files remain historical; README-835.txt and the current review manifests describe this candidate.
