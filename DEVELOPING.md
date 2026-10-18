# Developing Griffin House of Rooks

The live game is a static application. `index.html` is the entry point; there is no bundling step or production npm dependency. Serve the directory with `npm run serve` and open http://127.0.0.1:8080. A secure origin or localhost is needed for service workers. Preserve the existing relative paths for the owner's ZIP loader.

Install the development tools with `npm ci`. Run `npm run check` before a source change and after it. `npm run format` applies the checked-in formatting rules. The source check parses all root scripts, catches unused local variables and unreachable statements in maintained application code, and checks entrypoint and offline dependencies. It intentionally does not infer that a public global or a dynamically selected asset is unused.

## Runtime ownership

| Area | Source | Responsibility |
| --- | --- | --- |
| Game and transport | `game060.js` | Authoritative game lifecycle, legal actions, state replication, reconnect and host transfer |
| Frozen strategy and rules | `rules.js`, `bots.js`, `x1/` | Approved rules and intelligence; preserve exact bytes unless strategy work is explicitly authorized |
| Career data | `career-core.js`, `progression.js` | Atomic local career state, migration, public cards and achievements |
| Identity | `human-avatars.js`, `rita-avatar.js`, `founder-dev.js`, `founder-profile785.js`, `identity-choice.js` | Stable avatar IDs, public Jerome policy, selection and existing recordings |
| Bidding and hand choices | `unified-bidding752.js`, `bid-repair737.js`, `trump714.js`, `hand-order838.js`, `nest-manual838.js`, `nest-reveal838.js` | Presentation and input adapters around existing game actions |
| Audio | `audio-mixer.js`, `voice-queue.js`, voice modules, `cabin-ambience041.js` | Persisted bus levels, serialized voice cues and ambience scheduling |
| Layout | `style057.css`, orientation CSS, `angle-c-runtime.js`, `angle-c-characters.js`, `room*.js`, `review*.js`, `polish.js` | Approved artwork registration, responsive geometry and presentation synchronization |
| Menus | `landing783.js`, `friends803.js`, `menu-approved805.js` | Real existing controls and their original handlers |
| Loading and offline | `asset-loading772.js`, `sw060.js`, `hor-version.js` | Decode-before-reveal, complete precache inventory, runtime diagnostics |

These are classic scripts, loaded in dependency order in `index.html`. Some later adapters wrap earlier functions. Do not add `async`, `defer`, module scope, or reorder scripts without checking those contracts. Historical numeric filenames are stable runtime paths and provenance identifiers; they are not the active build number. Several files named `review` contain the accepted production layout, not an unused experiment. `founder-dev.js` is the active public Jerome identity policy, not a developer gate.

## Assets and generated recording data

Approved art, voices, card faces and animation atlases are original source assets. Preserve their bytes and attribution. Runtime-selected character poses, saved card backs and legacy identity paths cannot be judged unused from a single browser session.

`assets/audio/cabin041/pcm-data.js` and `assets/audio/presentation-pcm.js` contain generated PCM16 base64 recording data extracted unchanged from Build 845. They load synchronously before their consumers, preserving immediate audio timing and local-file compatibility. Application scheduling and decoding stay in their original modules. Do not hand-edit or format the sample strings. Source sample hashes and byte counts are recorded in the cleanup release evidence. The bid dock stylesheet now references the exact existing PNG rather than a duplicate base64 copy; the loader decodes that asset before revealing the app and the worker precaches it.

## CSS and compatibility

Stylesheets remain in the approved cascade order. Responsive rules, alternate fallback declarations, custom properties, animation rules and selector specificity are behavior. Formatting does not authorize flattening layers or deleting selectors after a single runtime coverage recording. The cleanup removed only exact repeated rules within identical conditional ancestry and exact repeated declarations.

Old storage keys and network setting fields can still be needed for migration or older peers even after a control is retired. Preserve that compatibility schema. Do not clear user storage, replace identities, or delete old service-worker caches to test an update. Use disposable browser contexts and synthetic career fixtures.

## Validation and release

`coordination/releases/846-cleanup/` in the Test repository contains the source manifest, cleanup report and regression evidence. Validation includes real legal gameplay, scoring, rotation through bid/discard/trump, menu and settings routes, audio routing, reconnect/privacy guards, host transfer, fresh offline use and an upgrade from Build 845 with saved synthetic career/settings.

Before publication, reserve the build through `coordination/BUILD_NUMBERING.md`, reread `brain/current.json` and the registry, and compare current main heads. Keep rollback refs, stage a candidate, inspect the exact changed/deleted paths, and update a branch only with an expected-head lease. Deploy Test first, verify the served files and browser behavior, then publish the same checked source to production only within owner authorization. A successful local browser test does not certify physical Android behavior or real WAN multiplayer.

Historical archives and Brain documents remain immutable evidence. Read the current Master Brain and required project history before development; a higher build number alone never establishes approval.
