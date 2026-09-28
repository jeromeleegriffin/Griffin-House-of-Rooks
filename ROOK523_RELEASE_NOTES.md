# Rook523 — Focused UI Refinement Roll

Built from the user-confirmed Rook522 refresh-loop baseline.

## What changed
- Preserved the Rook522 service-worker activation strategy; no controllerchange reload was reintroduced.
- Reworked first-run hierarchy around one obvious **Play now** action.
- Kept online host/join immediately available but visually secondary.
- Moved install and discovery/customization links behind compact disclosures rather than deleting them.
- Kept the chosen felt/theme as the default; table color remains discoverable under More controls.
- Reduced the in-game toolbar to immediate controls plus one More-controls menu.
- Gated Redeal, Perfect Hand, and Undo test tools behind explicit developer mode (`?dev=1` or localStorage `horDeveloperTools=1`).
- Stabilized the message lane so temporary messages do not resize the table.
- Changed trick/nest points to overlay the hand rail so point text does not create vertical reflow.
- Enlarged side-seat avatars and allowed larger portrait top/bottom avatars where screen width permits.
- Added bounded ellipsis behavior for long player names to prevent seat collisions.
- Replaced the rectangular LEADING tag with a compact brass LEAD medallion.
- Restyled Last 3 as a table-like physical tab.
- Bumped app/cache version to 523.

## Deliberately not changed in this roll
- Core deal/shuffle/scoring/rules logic.
- Multiplayer protocol semantics.
- The Rook522 refresh-loop fix.
- Default felt choice.
- Avatar image assets (the package did not contain the previously banked approved Jerome SHA, so no unverified portrait replacement was made).

## Verification
Static/version/ZIP checks are included in the package verification log. Browser/device play testing is still required before calling this release production-final.
