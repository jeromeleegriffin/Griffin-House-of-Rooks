# Griffin House of Rooks — 813 Landscape Nest Redesign

**Unapproved isolated review candidate. Neither GitHub live site was changed.**

The owner correctly rejected Build 812's discard page as an inadequate visual redesign: it still looked like a flat two-row card selector. This 813 review responds with a real visual rework over the previously working state, not a replacement game engine.

## What actually changed

- The 16 actual, original Rook card faces are larger and presented within a full-width midnight-blue felt area and brass/walnut edge.
- A separate Nest tray at the top has six empty card slots. Tapping a hand card moves its **mirror image** to one of those slots; the hand retains the real card until the original confirmed discard action. Gold selection borders and numbers show exact choices.
- A separate compact received-Kitty panel shows six incoming cards. The title explains clearly: the six chosen leave; the other ten stay.
- The action button tells how many remain to choose until six are selected. The original discard validation and card IDs remain authoritative.
- Five real viewport layouts tested, including 844×290 and 844×390 Android-like landscape; no card was clipped and no page scroll was needed.

## Protection and reproducibility

Based on complete `812.zip`, SHA-256 `c36dccf14338d76f07f262304ad9a126f69ce626fe763dc7473004e48fcc404f`, which includes all recovered late-811 owner fixes. `game060.js` portrait layout template was compared and found byte-for-byte unchanged. Landscape-only CSS loaded after 812 as `landscape-nest813.css`. Neither production nor Test GitHub repository was updated. Older 811, 812, approved 017 and 018 work remain untouched. No browser cache cleared.

## Tests and limitations

- Isolated Chromium real game: won 200 bid, displayed 16 full card faces, selected six, mirrored six Nest slots, rejected seventh, deselected and reselected, confirmed, advanced to green trump selection. No JS errors or missing assets in this test.
- Responsive visual inspections at 1536×709, 1280×800, 960×420, 844×390, 844×290, all no scrolling or card clipping.
- Portrait safety: PASS, bid → kitty Continue → discard six → confirm trump → play.
- Complete landscape hand: PASS through real scoreboard.
- Native Samsung / Onn, multiplayer, active offline service worker, audio, entire match NOT tested.

## Owner review

View `evidence/813_1536x709_selected.png` and `evidence/813_844x390_selected.png`, or load this ZIP into the existing original ZIP review loader. Do not deploy or promote without owner approval.
