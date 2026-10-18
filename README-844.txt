844 — Audit repairs / private resync and reconnect guards

BASELINE
Continues exact delivered 843.zip (SHA-256 a7a05eb3d2d3a5ed80d75bd4b4206042d2010fc93713fba36d0ea292a10cabf0). Runtime marker 844-network-guard; displayed label 844 Network guard. No deployment. 843.zip remains the rollback.

ALL FIVE APPROVED AUDIT ITEMS
1. Incoming player operations bind to the actual connected peer. Private discard resync also independently restricts its recipient to the bidder. Forged join IDs, another player's leave, another player's claimed action seat, private-hand requests and unapproved host-handoff announcements are rejected. Ordinary public state contains neither private hands nor reconnect credentials.
2. Host-issued random reconnect credentials are kept in session storage by room and out of public rosters. Reclaims preserve the original physical seat, team, index and hand. Matching a name, or asking for the first available temporary bot, no longer grants access to an old hand. A valid credential can restore the seat when the transport ID changes. A late close from an older transport cannot disconnect the replacement. Approved host transfer carries the reconnect credentials into the new room so the stricter reclaim rule preserves that workflow.
3. Match identity travels in public/resync state, hand results and highlights; ending-sound receipts use it. An object-lifetime fallback covers missing-ID contexts. Identical final scores in a later match now play their own finish, while duplicate openings remain suppressed. Sound assets and mixer behavior are unchanged.
4. GHR_BUILD now matches the 844 release instead of displaying 840.
5. Queued gameplay actions retain an authoritative match/hand/turn context. Reconnect holds the queue until state resync; stale contexts are dropped. The host independently checks action context and ownership before dispatch. Current queued actions still send once.

BEHAVIOR NOTE
A changed transport can reclaim the old hand using the private credential from that browser session. A different device/browser without that credential cannot claim someone else's old hand merely by entering the same name. No real player data or browser progress was erased to implement this.

VALIDATION
- 12 two-browser protocol/lifecycle/privacy checks: join, own private hand, public-state isolation, disconnect grace, exact same-ID restore, temporary bot, changed-ID credential reclaim, retained physical seat, private token exclusion, spoofed-seat rejection and unauthorized private resync rejection.
- One native full hand after disconnect/reclaim, two isolated human browser contexts plus two bots. Guest won the bid, used Kitty Received/discards/trump and both humans played through scoring; host and guest agreed on scores. The bridge exercised actual application message handlers; public signaling/TURN was not exercised.
- 19 targeted authorization/context/queue regressions plus 6 trusted-handoff snapshot/credential regressions.
- Audio decode/mute/routing/repeated-match cues and current build label passed.
- 12 rotation checks, 36 scoring/deck cases, 48 menu route/viewport checks, 16 settings cases and 7 retired-tool/persistence checks passed.
- Three complete standard 500-point matches, across landscape, portrait and rotating play: [{'number': 1, 'scores': [-90, 515], 'hands': 3}, {'number': 2, 'scores': [460, 540], 'hands': 5}, {'number': 3, 'scores': [265, 505], 'hands': 5}]. Zero runtime page errors, missing assets, match stalls or card-tap warnings. These are browser automation results, not physical Android audio/performance certification.
- Fresh worker offline reload and real same-origin 843-to-844 worker upgrade passed. Test career identity/counters, favorite partner, speed and mixer settings survived; previous cache retained. Unchanged artwork is reused from the immediate 843 cache only. No cache clearing or storage reset.
- No new art, CSS or gameplay/bot-strategy changes. All approved asset bytes and frozen rule/AI modules are unchanged versus 843.

AUTHORITY / CONTINUITY
Current Master Brain AE and complete foundational/history reading remain retained in this continuous workstream. Both permanent continuity/reading rules remain verbatim in their review-continuity files. Every future handoff and startup prompt must reproduce BOTH entire rules verbatim and explicitly require every successor to pass them forward. No published documentation or production repository was changed.
