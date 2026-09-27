# Griffin House of Rooks — Rook492

Built from authoritative Rook491.

## Changes
- Replaced the repeated three-beep Your Turn alert with one short, soft descending cue.
- Local Career/Achievements now default ON for players who have never explicitly chosen OFF.
- Existing stored career totals are silently synchronized on startup so old achievements do not flood the screen.
- Live human achievement checks now occur after authoritative bid-win, trick-resolution, and hand-resolution stat updates instead of waiting only for match end.
- Achievement celebrations are queued one at a time (maximum one visible), preventing stacked popup dumps.
- Existing lifetime statistics are not reset or rewritten by the new live-event checks.
- SOL research is not integrated; production AI remains the Rook491 lineage.

## Validation
- JavaScript syntax checks passed for game.js, progression.js, sw.js, and hor-version.js.
- Version/cache references bumped to 492.
- Full ZIP starts with index.html at archive root.
