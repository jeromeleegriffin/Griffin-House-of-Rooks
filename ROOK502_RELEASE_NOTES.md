# Rook 502 repo change

Built directly from Rook501 after testing showed the doooop was attached to the wrong lobby seat layer.

Changes:
- Fixes the low “doooop” cue on the actual waiting-room empty-seat click used by the host before choosing a bot.
- Keeps the existing bot-seated sound unchanged; it remains a separate cue after the bot is selected/seated.
- Keeps the welcome-screen seat cue from 501.
- No lobby CSS/layout changes.
- No change for the one-off Message Table popup because it remains unreproduced.
- Version/cache markers bumped to 502.

Repo upload: replace only the files in the repo-change package.
