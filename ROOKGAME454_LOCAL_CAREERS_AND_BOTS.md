# RookGame454 — Local Careers + Global-Ready Bots

## Safe default
The build starts in **PREVIEW** mode. No progression migration is performed automatically. Cloud progression/recovery remains OFF.

## Test before activation
From the browser developer console, or a temporary diagnostic control, run:

`HORProgression.localCareer.showActivationPanel()`

Use **Dry Run** to inspect existing Jerome/Host/bot lifetime records and celebration previews without writing progression.

## Turn on everything locally (Cloudflare progression still OFF)
In the activation panel choose **Turn On Local Careers**. This sets local mode, creates the anonymous local identity/recovery code, mirrors existing `rookLifetimeStats` into career ledgers, retroactively calculates levels/achievements, and enables future local level/achievement celebrations. It does NOT enable the progression cloud endpoint.

Equivalent console command:

`HORProgression.localCareer.activateLocal()`

## Turn back to preview
`HORProgression.localCareer.deactivateLocal()`

This stops future progression updates/celebrations but deliberately does not erase saved career data.

## Bot design
Official bots use stable IDs derived from their permanent names (`bot-cinder`, etc.). Their local lifetime career is mirrored from the same authoritative game stats as human careers. RookGame454 also begins a per-device relationship record for each bot: games together, human-vs-bot wins, partner games, and partner wins.

These stable bot IDs are global-ready. When the future Cloudflare progression service is enabled, completed-game events can contribute to a separate worldwide bot career without replacing the player's local bot history. Cloud aggregation is intentionally not enabled in this build.

## Backup / recovery
RookGame453's Career Backup / Restore and Recovery Kit remain included. Create a backup before testing activation if the device already contains important lifetime statistics.
