# Career stats → GitHub

The game on a phone cannot write to GitHub by itself (that would require putting your password/token in the app). A free Cloudflare Worker sits in the middle.

## One-time setup

1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained.
   - Resource: only `Griffin-House-of-Rooks`
   - Permission: Contents Read and write
2. [Cloudflare Workers](https://dash.cloudflare.com) → Create worker → paste `stats-worker.js`.
3. Worker Settings → Variables / Secrets:
   - `GITHUB_TOKEN` = the token
   - `GITHUB_REPO` = `jeromeleegriffin/Griffin-House-of-Rooks`
4. Copy the `*.workers.dev` URL.
5. Put that URL in `game.js` as `HOUSE_STATS_ENDPOINT` and ship that build / Pages copy.
6. Commit `stats/players.json` if it is not already in the repo.

Players do nothing. No prompt, no URL to paste. Any phone hosting a match with that build sends one summary.

`HOUSE_STATS_ENDPOINT` empty (current) = no upload.
