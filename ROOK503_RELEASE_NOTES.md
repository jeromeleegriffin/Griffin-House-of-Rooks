# Rook 503 — sound reliability update

Built from the Rook501 package supplied by Jerome, with the documented Rook502 waiting-room doooop fix carried forward before applying this sound-only update.

Changes:
- Fixes selectable My Turn tones so playback waits until Web Audio is actually running on mobile browsers.
- My Turn tone selector previews the selected tone immediately.
- Turning the My Turn sound option on also gives an immediate preview.
- Persists the My Turn sound on/off preference locally.
- Preserves the opening Turn Over Top Nest Card suppression rule so the first-turn cue does not collide with the reveal sequence.
- Preserves the separate bot-seating sound.
- Preserves Rook502's original low doooop cue on the actual host waiting-room empty-seat click.
- No avatar, table-layout, bot-personality, scoring, bidding, or gameplay redesign changes.
- Version/cache markers bumped to 503.
