# Online X1 — server integration, 2026-10-21

The canonical Worker is ../worker-live.mjs. It reuses the approved native core.js, sha256.js and bidding.js byte-for-byte, with bridge.mjs adapting the server's authoritative state. Native R10 assets, HTML, adapter, audio, portraits, settings and service-worker behavior are unchanged.

## Intelligence contract

New standard 46-card hands use X1 bidding, nest discard, trump choice and sampled card play. Input is the acting bot's own hand and confirmed public information. A bidder may use its own buried nest. Other private hands, unknown nest, offline partner-mask and Anchor assistance are excluded. Seeds are deterministic from the own/public view. Unsupported rule variants and Moon contracts retain the existing safe server bot. An X1 sampling failure uses legal Sol7 for the remainder of that hand; an adapter failure retains the legacy legal bot. Existing persisted hands without X1 memory stay legacy until the next deal.

Public snapshots expose only aggregate engine/version/phase counts and fallback diagnostics. Private plans, void memory, seeds and hidden cards stay on the server. The in-request performance.now diagnostic remained zero in hosted QA; do not treat it as a CPU benchmark. Hosted tests prove completion within bounded HTTP timeouts, not device-scale capacity.

## Rebuild

Export the exact R10 Worker from Test commit a5804a9035b3a2f56b38231cec4ff44da686655f (cloudflare/live/worker-live.mjs) to a separate temporary file. Its SHA-256 must be a8cb41c717bf1178373e559cc6b36263d45e172474870849f8b0af4e88672eae. From the repository root:

```sh
python cloudflare/live/x1/rebuild.py --base /absolute/path/to/r10-worker.mjs --engine-dir x1 --output cloudflare/live/worker-live.mjs
node cloudflare/live/x1/privacy-unit.mjs
node cloudflare/live/x1/reliability-unit.mjs
node cloudflare/live/x1/protocol-regression.mjs
```

The builder refuses a different base or changed frozen engine hashes. Keep later server changes when preparing future releases; this recipe reproduces this checkpoint only. The older build-live.py refuses to overwrite X1.

## Verification scope

Privacy: poisoned private-hand getters, hidden-deal invariance, deterministic replay, no partner input, public bid/void history, rules/Moon fallback and forced sampled-play fallback. Persistence: actual RoomDO with structured-clone simulated storage/time, actor reconstruction, ten-minute detach, exactly-once retry, stale/unauthorized requests and deliberate one-hour idle expiry. Local full matches and relevant inherited rule/pacing/collection/readiness regressions passed.

Hosted QA uses normal root-session, create/join/fill/start/ready/actions/rejoin/close routes on a separate Worker and separate SQLite namespace. It runs actual Cloudflare complete matches with distinct simulated human identities from one GitHub runner. It is not a rendered browser test, four physical devices, Android OS suspension, cellular roaming, real QR scanning, installed-cache upgrades or offline asset-cache acceptance. Keep those gray checks labeled unverified. The current change adds no UI and does not reopen the Lead pill.

See coordination/releases/online-x1-20261021/ for exact hosted evidence and release receipt. Production acceptance creates and closes only its own test room. Never reset room storage, replace secrets, clear saved preferences, or use the QA signing secret in production.
