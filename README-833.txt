833 — Stamp and player-panel review

Isolated playable ZIP based on832.zip (SHA25657e4905e2098e31adb006f6fadca833ced51e53359c4d52e025b183bb04a1f0d). No deployment, remote source changes, player-data clearing or rule/AI changes. Current remote Brain pointer previously verifiedAE;832 source artwork and both permanent continuity rules retained verbatim.

Current fixes:
- Shared physical Trump stamp now has a950ms minimum animation at3x/MAX (1950ms at1x). The previous MAX duration was98ms, explicitly skipped by the renderer. First-trick presentation now waits for the stamp to complete; human input and bot actions share the same brief presentation gate. The host sends its presentation duration/state to clients. Reduced-motion still uses the immediate imprint.
- Top player's landscape name and level use a compact top-right panel, with status beneath. Positioned right of the top avatar and above the visible fireplace flames; no longer over played cards. Longer Thinking/Bid status checked at four viewport sizes.
- Partner photo choices now show a selected checkmark, gold outline, selected-name feedback and Use [name] confirmation. Portrait native selector gets the same confirmation text. Choice survives reopening/reloading. Entrance Change Partner touch area enlarged.

Validation:
- Native MAX auction/discard/trump confirmation exercised; stamp contact and completion recorded.
- Shared animation exercised for all four chooser seats,1x/3x/MAX,portrait390x844 and landscape844x390:24 cases. Actual moving transforms, press/contact and completion checked; no first-trick interruption. These repeated directional cases use isolated presentation fixtures with native hostProcessTrump; they are not24 complete network games.
- Top panel long-status layout checked at844x245,844x273,844x390 and1280x720; screenshots inspected.
- Partner selection and persistence checked with touch-enabled phone contexts at844x245,844x273,844x390 and390x844.
- Native195-bid hand through discards, trump, card play and score; ordinary/Moon sizing and200 selection across resizing checked.
- Fresh service-worker/offline reload verifies coherent833-stamp-review markers. ZIP CRC and every packaged source byte verified.

Limits:
Physical handset appearance and perceived motion await owner review. Network multiplayer was not exercised; shared public presentation fields were inspected, not certified through remote peers. No new audio listening certification. Felt/room/lantern artwork remains832; the lantern shelf integration remains a separate visual follow-up. Other earlier effects/dealing checks are retained history, not newly asserted as completed in this pass.
