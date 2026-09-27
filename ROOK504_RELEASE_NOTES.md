# Rook504 — synchronized My Turn timing

Built from the supplied Rook503 package after verifying its production markers against GitHub main.

- Adds a 180 ms hesitation before the gameplay My Turn notification.
- My Turn sound, vibration, and visual pulse fire together on that delayed beat.
- Settings tone previews remain immediate.
- Preserves all 19 selectable My Turn tones and rookSoundTurn persistence.
- Preserves opening Turn Over Top Nest Card first-turn sound suppression.
- Cancels the delayed cue if the turn opportunity changes before it fires.
- No lobby, bot, scoring, bidding, progression, card-scatter, or Visual Lab changes.
- Deployment/cache markers bumped to 504.
- HOR_LIVE_VERSION corrected to 504.
