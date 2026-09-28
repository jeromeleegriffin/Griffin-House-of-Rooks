# Rook536 Release Notes

- Fixes deliberate multiplayer leave/re-entry cleanup: the last human host now destroys the Friends room session and clears only transient room/rejoin state before returning to lobby.
- Client deliberate leave also tears down stale PeerJS/session state before reload.
- Rooms are not allowed to persist as bot-only sessions after the last human deliberately leaves.
- If other humans remain, host is directed into the existing host-transfer path instead of silently killing or zombifying the room.
- Enforces one avatar owner per active table. Used avatars are disabled and marked IN USE in the picker; host also rejects duplicate avatar changes and assigns a free avatar on join if needed.
- SOL phone guide is explicitly labeled as a reference rather than false device emulation; on roomy desktop windows the SOL panel is kept to the left of the reference area.
- No rules, scoring, dealing, AI, career/progression, or refresh architecture changes.

Validation target: Create/join -> play -> deliberate leave -> Create/join again repeatedly without clearing browser data.
