# Online card audio repair — 2026-10-21

Continue R8 cumulative/R9 runtime; do not restart. Owner authorized continued repair and publication despite blocked Cloud Browser audio verification. This is a focused Cloudflare adapter repair, not a native game redesign or new asset release. Both GitHub sites still use the same R9 native assets and route Friends to this shared Worker.

## Observed phone evidence

Owner phone report preserved in Test commit ded87ce8e9142553e4e808f8616ecb08aec62316, coordination/releases/r9-audio-diagnostics-20261021/OWNER_PHONE_REPORT.json. Test tone heard=true, native audio running/clock progressing, mute off, cards/turn/ticks enabled, main mixer1, voices0.7. All retained samples in play/score have zero cardLandingBuffers. Cabin running with fire and wind sources. Zero voice starts in a reconnect hand alone does not prove broken speech.

## Reproduced defect and fix

Actual gameSnapshot replay against R9 adapter reproduces zero loaded impacts when reconnecting during play. The native loader is called by deal presentation; a reconnect bypasses it. Cloud adapter also bypasses legacy host notifyCardPlayed. Candidate warms the original loader on first/new-hand cloud snapshot and trusted pointerdown (supports retry after failure). It observes confirmed public trick cards and invokes original notifyCardPlayed for the latest newly seen card only. Restore, new-room/new-hand and duplicate snapshots are quiet; seen card IDs remain local only. No optimistic sound for rejected moves. Mute/effects/preferences and special-card dispatch remain native.

## Verification and limits

Regression uses actual gameSnapshot, preloadCardLandingSounds058, notifyCardPlayed and playCardSound with mocked AudioContext. It verifies all five existing WAVs through the real Worker asset route, source.start on new confirmed play, no reconnect/duplicate/cleanup burst, new-hand/room isolation, muted/disabled effects, and failed-load retry. Original R9 fails reconnect preload assertion. Candidate passes. Existing entry-security, collection/reconnect and diagnostics privacy checks pass. Main/ambience context-recovery regression remains passing. This is not a browser or physical audible acceptance claim. Cloud Browser native credential state remains unavailable; do not resume login/reconnect loops.

## Ambience finding — unresolved

Embedded PCM and preserved WAV fire/wind agree. Fire source RMS −61.2 dBFS and wind −70.4 dBFS; at owner reported fire10%, cabin6% (bus0.2), estimated output fire −95.2 and wind −84.3 dBFS. Provenance explicitly says deliberately low levels. No asset corruption or stopped ambience context established. No ambience or approved male voice recordings changed by this repair. Needs a separately verified loudness correction; do not claim all sounds fixed or reset saved sliders.

## Continuity and rollback

Existing room namespace bb1bf1c32b68451cbe5db6fee3066fa0, TEST_GATE_KEY, ACTION_LIMIT/ENTRY_LIMIT and immutable R9 asset commit374bf70223a9df7113d83786cd55f2ee6c25f4ae retained. No room reset, service-worker clear, paid plan or preview activation. Before deployment live Worker version2f2dc7d6-90bb-4f99-9443-76041bd6829d. Rollback branches rollback/pre-card-audio-20261021 preserve both repository heads. See LIVE_RECEIPT.json after activation. No new ZIP.
