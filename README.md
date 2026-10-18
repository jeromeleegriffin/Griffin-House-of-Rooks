# Griffin House of Rooks

A four-player partnership Rook game by Jerome Griffin, built for phones and tablets.

Open `index.html` through a local server or the existing ZIP loader. The published application needs no production npm packages or build step.

For developers, start with [DEVELOPING.md](DEVELOPING.md). It explains module ownership, script and stylesheet ordering, approved assets, frozen intelligence, saved-data compatibility and validation. Run `npm ci` followed by `npm run check` before changing the source.

Current runtime: **846-source-cleanup**. Runtime identity is available to support tools through `HORRuntimeTruth()`; the experimental landscape corner caption has been removed.

Historical review notes inherited from the exact Build 845 source are preserved unchanged under [docs/history/build-845-inherited](docs/history/build-845-inherited/). They describe earlier checkpoints and are not current test receipts. Current source hashes, regression results and release status are in `coordination/releases/846-cleanup/` in the Test repository. The current Master Brain pointer is `brain/current.json`.

Live sites:

- https://jeromeleegriffin.github.io/Test/
- https://jeromeleegriffin.github.io/Griffin-House-of-Rooks/
