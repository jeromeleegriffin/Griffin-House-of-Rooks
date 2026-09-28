# Griffin House of Rooks — SOL Layout / Table Architecture Notes

Authoritative engineering notes captured during Rook530 → Rook531 layout work.

## Non-negotiable preservation rules
- The user's Rook530 portrait SOL layout is valuable production work. Never Reset All, clear it, or silently replace it.
- Preserve portrait and landscape layouts separately.
- Editor OFF must have zero layout influence. Editor ON but idle must not periodically reposition elements.
- Gameplay rerenders must not overwrite SOL-owned positions.
- SAVE persists a candidate. LOCK protects a candidate from accidental movement and is reversible. FINALIZE/EXPORT is the handoff for baking production defaults.
- Prefer stable IDs/identities over generated nth-of-type selectors. Migrate fragile selectors when safe.

## TRICK / center-area architecture
- `#trickArea` is functional infrastructure, not decorative UI. Played trick cards depend on it.
- Hiding TRICK makes played cards disappear; showing it restores them. Moving TRICK moves played cards.
- Never delete or production-hide the TRICK parent just to remove a visual artifact.
- Played cards live in the trick stack inside the TRICK area. Preserve their coordinate space and animation behavior.
- The old empty styled `.trick-caption` was a likely source of the small black/gold dash/hyphen artifact. Remove the empty caption/artifact at source while preserving the functional TRICK container.
- The large transparent TRICK/center hitbox must not unnecessarily intercept clicks/touches outside actual played cards. Empty structural space should be non-blocking where safe.
- Validate TRICK bounds with 0, 1, 2, 3, and 4 played cards and when the trick clears.

## Center-area siblings / transient elements
- TRICK is not the whole center UI. Center-area also contains/hosts separate systems such as Nest, widow spread, bot-thinking/waiting UI.
- `botThinking`/Thinking Box must be independently selectable and positionable. Moving Thinking must not move TRICK/cards; moving TRICK must not move Thinking.
- Provide a forced preview/freeze for Thinking so it can be edited without waiting for a bot state.
- Measure center/trick geometry before cards, during 1–4 cards, while Thinking appears/disappears, and after trick clear. The central play zone should remain geometrically stable.

## Trump UI findings
- Trump choice and trick play are different UI states and must be editable separately.
- Portrait trump selection is built in/through `#actionPanel`.
- Landscape uses its own trump chooser/bar (`#ltTrumpBar`).
- The trump stamp is separate from both choosers.
- Do not treat the tall trump-selection boxes as TRICK children merely because they overlap the same visual area.
- SOL must expose portrait Action Panel, Trump button group, Landscape Trump Bar, and Trump Stamp independently.
- Trump stamp: NO GH emblem. Preserve its approved physical size and landing position. RED, BLACK, GREEN, and YELLOW must all fit fully; adapt font size/tracking, never abbreviate or resize/move the stamp.

## Seat identity targeting
- Each of the four seats must expose Avatar, Name, Level/XP, and temporary marker independently.
- Top and Bottom previously had bad target grouping. Bottom Name could move Bottom Avatar; Top selection could target a combined group. This must not return.
- A Seat Group parent may exist only as an intentional whole-seat target.
- Avatar resize must affect the visible portrait/ring unit, not merely an invisible outer container.
- Side-seat layouts that already work should not be disturbed without reason.

## Direct manipulation / editor behavior
- SOL must support direct click/touch selection from the live table and direct drag.
- EDIT/MOVE MODE must intercept normal button actions while manipulating clickable controls; leaving edit mode restores normal behavior.
- Selected elements should support direct resize handles where sensible, plus X/Y/W/H/scale/font/Z fields.
- Panel movement/resizing must never move the selected game element.
- SOL panel should be draggable, collapsible/minimizable, dockable, and drag-resizable, with position and size remembered separately for portrait and landscape.
- Provide parent AND child navigation. Clearly label protected/structural elements.
- "Pick Anything" means any visible table/UI DOM element, not only a hard-coded shortlist.

## Recovery / safety controls
- Provide LOCK ALL and UNLOCK ALL. They change lock state only.
- Provide UNHIDE ALL. It changes only SOL visibility state; it must not alter coordinates, size, scale, font, Z, or lock state.
- Provide a Hidden Items list for one-at-a-time recovery.
- Prefer KEEP / HIDE / REMOVE FROM PRODUCTION markers over destructive deletion inside SOL.
- Protected structural elements such as TRICK should warn before hide/remove operations.

## Transient UI Workshop
- Temporary UI must be editable without racing timers.
- Provide Preview/Spawn for known transient UI, Edit Freeze, Catch Next Popup, and recent Transient History.
- Freeze should prevent auto-dismiss and gameplay activation while editing.
- Include Thinking, Shoot the Moon, winner/result notices, achievements, Nest/trump prompts, celebrations, and other discovered transient elements.

## Phone / responsive editing
- Landscape editing in Rook530 was not practical enough; do not require the user to manually reproduce portrait work there.
- Provide a hard viewport/safe-area overlay with live dimensions (800×360 is a known working landscape test size), off-screen shading, and optional inner safety margin.
- Provide temporary snap/alignment guides: viewport center, safe edges, element edges/centers, equal spacing, avatar alignment, and optional Top↔Bottom / Left↔Right symmetry.
- Provide a modifier to temporarily disable snapping.

## Copy / names / collision tools
- Replace vague Copy Value with clearer Copy X, Copy Y, Copy Size, Copy Style, Copy All Layout where practical.
- Name elements need temporary Test Name text without changing saved player identity. Include useful short/8-char/12-char/max/custom tests.
- Provide collision/clearance visualization against protected zones, especially the human hand (10 and 16 cards), popups, central play, seats, and action controls.

## Layout export/import
- Export/import is required for moving work between builds and devices.
- Preserve portrait/landscape X/Y, W/H, scale, font, Z, hidden/locked state, and stable element identity.
- Do not silently bake accidental hidden structural states into production.
- The Rook530 portrait export captured 23 records and had every `hidden` value false; it is preserved separately in `ROOK530_PORTRAIT_LAYOUT_EXPORT.json`.

## Card backs
- If card backs look soft/corrupted, first compare source image dimensions/hash with display dimensions and inspect transforms/background-size/object-fit/SOL scaling.
- Preserve approved artwork when the source is intact; fix the rendering/scaling pipeline rather than replacing art.

## Table stability principle
- Once play begins, the table should be geometrically boring/stable. Temporary information must use predefined overlays/slots and should not reflow permanent table geometry.
- Prime table space belongs to the current game state. Inactive/transient UI should collapse, move to an edge, or disappear without shifting core pieces.
- Never sacrifice card readability, legitimate game states, mobile usability, or multiplayer behavior for visual cleanup.
