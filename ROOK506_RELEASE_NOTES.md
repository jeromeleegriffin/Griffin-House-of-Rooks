# Rook506 — clean room leave + reliable Offline first press

Cumulative build.

Includes the skipped Rook505 work:
- Minimum 450 ms from the actual previous played-card SFX to the synchronized My Turn cue.
- Sound, vibration, and visual My Turn cue remain synchronized.
- 180 ms baseline remains for non-card turn transitions.

Rook506:
- Leave Room now deliberately closes host/client data connections.
- Disconnects/destroys the active PeerJS peer before returning to the lobby.
- Cancels pending network retry timers and blocks reconnect work during teardown.
- Clears active multiplayer room/player/game state before reload.
- Play Offline now cancels stale multiplayer retry/join state before creating the local table.
- Intended to make Play Offline respond on the first press after leaving a room.
- No unrelated lobby layout, bot logic, scoring, progression, or visual changes.
