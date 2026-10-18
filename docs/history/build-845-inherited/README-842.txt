842 — Player menu only / retired test-code cleanup

BASELINE
Continues exact delivered 841.zip, SHA-256 cddeaf2f61678ba9fdd024107d8a02dc7ff16f1847825e4696d0912e416a9125. Current runtime marker: 842-player-menu. No deployment or repository changes. 841.zip remains the rollback.

OWNER REQUEST
Remove the hidden Jerome/SOL testing menus and all their options. Owner then explicitly expanded this to remove the actual perfect-hand dealer, lucky spinner and other unused code, not merely hide the menus.

REMOVED
- Owner Tools entry and the local dev/name/saved-setting unlock paths. The current main menu is the only menu interface, including on localhost with dev=1.
- SOL visual layout editors, element moving/resizing/picking/import/export controls, diagnostic/emergency panels, recorders and automatic test bars.
- Perfect-hand dealing and test redeal/undo code, including the old per-play undo snapshot copies and their wrappers.
- Lucky spinner, extra lucky special-card pulls, settings plumbing, saved preference hooks and wheel styling.
- Forced Bird/Red Two top-nest test override. Ordinary Show Top Nest Card remains available.
- Career dry-run/activation/preview/expert-test screens and the isolated phone-test module. Normal live careers, awards, backups and restore remain.
- Experimental menu switches, fake lag/double-tap test hooks and unused experimental side panels. Supported networking safeguards, relay configuration, thinking cues and Wait for me behavior are retained.
- Old source/stylesheet/service-worker aliases, unused test pages, unused worker experiments and other unreferenced helpers. Exact removed-file ledger is in REVIEW-MANIFEST.json.

CLEANUP SIZE
17 obsolete source/entry files removed. Net source reduction versus 841: 2,509,145 bytes, about 2.51 MB before ZIP compression. Most game size remains approved art/audio.
The offline shell was normalized from 1571 versioned/duplicate requests to 1448 current dependency paths. The new build cache is separate; cacheLookup handles query versions. Same-path image reuse reads only the immediate 841 cache, and only images proven byte-identical. No existing cache or saved career is cleared.

PRESERVED
All artwork, card faces, character assets and audio are byte-for-byte unchanged. Frozen X1/Sol7 strategy/worker files, rules and bot algorithms are unchanged. The normal default remains X1 with existing compatibility/fallback behavior; the retired manual intelligence selector and its old stored override are gone. The public Jerome avatar remains a normal character.
Current player menu routes remain Full Screen, Join by Code, Match Score, My Profile, My Career & Awards, Play With Friends, Sounds & Atmosphere, Game Setup, How to Play, Install on This Phone and Leave Table, with their ordinary availability rules.
Public rule controls and audio settings remain. Internal hidden backing controls are retained only where the current menu's handlers need them; the old visual menu/extra options are not shipped. Old developer/layout/testing keys are ignored rather than deleting progress or changing browser storage.

VERIFICATION
- Boot with no runtime errors; syntax and local dependency checks.
- 48 route/viewport checks and all settings pages in portrait/landscape.
- All partner/avatar/bot navigation pages, including 245px-high landscape.
- Old developer flag, dev=1, saved experimental/lucky settings and saved editor transforms cannot restore tools or activate overrides. Canonical career identity/counters survive reload.
- 55 native regressions: bid persistence/rotation, menu access, Kitty Received, fixed sixteen slots, touch drag, exact retained order, six-card confirmation, trump and a complete hand to scoring. Card/discard geometry exactly matches 841 at five viewport sizes.
- In-game menu/seat stats/scoring/history checks.
- One complete standard 500-point match with portrait/landscape rotation: Griffin 450 — Raven 550, 5 hands. No runtime page errors, missing local assets or stalls.
- Fresh active-worker offline reload passes; runtime markers are coherent. Exact artwork reuse fixture requests the seeded image zero times and retains the old cache.
Physical Android listening/installation and a real network multiplayer session are not certified by these local tests.

AUTHORITY / CONTINUITY
Current Master Brain AE was verified in this continuous workstream and complete foundational/history reading is retained. Published older runtime does not replace approved 841 as this task's source. Both permanent rules remain verbatim in review-continuity/CHAT_CONTINUITY_RULE.md and COMPLETE_BANK_READING_RULE.md. Every future handoff AND startup prompt must reproduce BOTH full rules verbatim and explicitly require each successor to pass those obligations to every following assistant.
