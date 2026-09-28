# Rook532 Release Notes

Built cumulatively from the verified Rook531 candidate.

- Bakes the latest Rook531 portrait checkpoint for stable named selectors. Fragile nth-of-type selectors are preserved in the prior exported checkpoint/history but intentionally not promoted as production defaults.
- Corrects the portrait bid dock baseline to x=29, y=47, scale=.85.
- Preserves the chosen Bot Thinking placement x=24, y=-50, scale=1.04.
- Adds SOL FREEZE as a diagnostic mode distinct from LOCK. LOCK prevents editor movement; FREEZE pins the selected visual object to its current viewport point while SOL is open so layout/rerender fights can be isolated.
- Gives the discard picker/actions stable SOL identities instead of requiring nth-of-type modal selectors.
- Redesigns portrait discard flow so Confirm Discard stays directly below the selectable card region instead of being stranded at the bottom of a large empty screen.
- Removes the empty TRICK placeholder word while preserving the functional TRICK container and its geometry/animations.
- Moves the portrait trump stamp upward without changing its physical stamp size.
- Tightens trump word fitting for RED/BLACK/GREEN/YELLOW, including the previously clipped GREEN case.
- Keeps core rules, deal, shuffle, scoring, multiplayer protocol and refresh architecture untouched.
