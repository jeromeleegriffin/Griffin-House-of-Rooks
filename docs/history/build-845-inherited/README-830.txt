830 — FULL-ROOM LANDSCAPE REVIEW

Continue from 829.zip (SHA256 d30d97fa6d12f35857be2ec02716e4eaa7bb315453fb16a9835c5ca81ccd6ccc). This is an isolated playable ZIP. Serve the directory or use the existing ZIP player with index.html. No live servers or repositories were changed.

Approved room design implemented:
- Full-width library and oval table on entrance and waiting screens.
- One bottom action dock: Play Offline / Play With Friends / Join by Code.
- Compact player identity chip; original name, avatar and voice controls behind Edit player.
- Partner name and Change Partner remain near the opposite seat.
- Waiting-room names open player stats; separate Change buttons open the ranked bot picker. Cancel keeps the existing bot. Choosing a replacement changes that seat. Remove bot remains available inside the picker.
- Native Invite, QR availability, code copying, Fill seats, Start Game and Leave Table handlers remain. QR retains its existing HTTPS/public-host policy, so local HTTP tests normally hide it.
- Smaller near-side game avatars (398 instead of 470 scene units; top stays304), keeping nearer players slightly larger than the top player. Top nameplate repositioned clear of the lantern.
- Lantern moved from behind the left character onto the shelf between left and top seats. Flicker sample moved with it; room asset is a new file.

Dealing correction:
Portrait source was read directly. Portrait's sixth nest card is face up IN FLIGHT, then the deal continues immediately. It does not pause mid-deal for a separate table flip. 830 uses that shared renderer/loop with landscape coordinates and table-plane sizing. The independent landscape flight and 829's added 1.46-second pause were removed. Nest moved inside the landscape scene's visible stacking layer (it previously sat behind the scene). Nest card backs use the approved card-back art. Reveal OFF deals the same46 cards without a face-up reveal or bird reaction. Reveal ON shows only the top nest card and invokes the existing bird reaction once. No game-rule or AI changes.

Validation:
- Entrance, identity edit, partner save, join form and waiting-room actions at844x390,844x245,1280x800.
- Cancel/change/remove/reseat/stat/close actions tested through live controls with an isolated waiting-room signaling fixture.
- Native waiting-room Start enters an actual deal.
- Both reveal settings:46 card flights; no gap above140ms in final 1x runs; reveal ON exactly1 face-up flight and one existing bird sound source; OFF zero face-up flights and zero bird reactions. Moving cards and landed nest visually inspected.
- Actual195-bid full hand through discard, trump and score. Moon/ordinary bid box dimensions identical. Black and red bird sound sources each start once. Portrait rotation has no document overflow.
- Offline reload restores830 and approved signature shuffle.
- No script errors or missing artwork in final runs.

Limits:
Network multiplayer was not verified. Waiting room tests isolate signaling; bot/seat operations remain the actual application handlers. Audio checks verify Web Audio starts, not handset speaker volume. Historical documents inherited from previous builds remain historical; this README and REVIEW-CHECKS.json describe830.

Continuation authority:
Current-session verified remote Brain was AE, inherited source816-derived review. This is not an805 rollback or rejected824–828 candidate. No remote Brain changes. Preserve CHAT_CONTINUITY_RULE.md and COMPLETE_BANK_READING_RULE.md verbatim. Read current brain/current.json before future repository work.
