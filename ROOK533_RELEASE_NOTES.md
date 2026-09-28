# Rook533 — SOL viewport stability + phone guides

- Starts from Rook532.
- New SOL storage generation seeded from Jerome’s latest authoritative portrait export, preventing stale older SOL localStorage from silently overriding the approved checkpoint.
- Event-driven SOL stability pass reapplies saved ownership after live UI state/class changes; no geometry polling loop.
- Critical portrait UI receives viewport edge clamping without changing the saved authored X/Y values.
- Added toggleable Galaxy S24 reference box and Universal Safe box.
- Added off-screen warning outline for clamped critical SOL objects.
- Preserves Rook532 discard-flow cleanup, Trump adjustment, and gameplay logic.
- No intentional rules, scoring, shuffle, deal, multiplayer, or refresh-architecture changes.
