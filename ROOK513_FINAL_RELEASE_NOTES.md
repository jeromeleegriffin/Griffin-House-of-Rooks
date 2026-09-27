# Rook513 Final cumulative roll

Built from Jerome's complete Rook510 package, preserving its full project contents and layering the verified 512/513 production changes.

Changes:
- Unified APP_VERSION, shell BUILD, cache-busting, live beacon and service-worker release to 513.
- Preserved legacy HOR_BUILD=497 because its semantics are separate/unverified.
- Added 512/513 UI layers while retaining the complete 510 base.
- Hardened Play with Friends so successful host creation remains on the waiting-room/table-code screen instead of falling into Join with a code.
- Preserved approved room-layer hooks and 513 avatar/seat styling.
- No intentional rules, scoring, AI, dealing or card-mechanics changes.

Note: room-card-club.jpg was not present in the complete 510 package available to this build environment, so this ZIP does not fabricate or substitute that approved artwork. If the live repository already contains it, keep that file when deploying this package.
