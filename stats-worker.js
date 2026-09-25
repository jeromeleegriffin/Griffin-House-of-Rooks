/**
 * House of Rooks — Cloudflare Worker (free plan is enough).
 *
 * Setup:
 * 1. Cloudflare Dashboard → Workers → Create → paste this file.
 * 2. Settings → Variables:
 *      GITHUB_TOKEN  = fine-grained PAT, Contents: Read and write, this repo only
 *      GITHUB_REPO   = jeromeleegriffin/Griffin-House-of-Rooks
 *      STATS_PATH    = stats/players.json   (optional)
 * 3. Copy the worker URL (https://….workers.dev).
 * 4. In the game Host options, paste that URL into "Stats worker URL".
 *
 * The worker merges career stats by player name into stats/players.json
 * on GitHub. The game never holds your GitHub token.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'POST only' }, 405);
    }
    const token = env.GITHUB_TOKEN;
    const repo = env.GITHUB_REPO || 'jeromeleegriffin/Griffin-House-of-Rooks';
    const path = env.STATS_PATH || 'stats/players.json';
    if (!token) return json({ ok: false, error: 'Missing GITHUB_TOKEN' }, 500);

    let body;
    try { body = await request.json(); } catch (e) {
      return json({ ok: false, error: 'Bad JSON' }, 400);
    }
    const incoming = Array.isArray(body && body.players) ? body.players : [];
    if (!incoming.length) return json({ ok: false, error: 'No players' }, 400);

    const api = 'https://api.github.com/repos/' + repo + '/contents/' + path;
    const headers = {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'house-of-rooks-stats',
    };

    let sha = null;
    let store = { updated: null, players: {} };
    const get = await fetch(api, { headers });
    if (get.status === 200) {
      const file = await get.json();
      sha = file.sha;
      try {
        const text = atob(String(file.content || '').replace(/\n/g, ''));
        store = JSON.parse(text) || store;
      } catch (e) {}
    } else if (get.status !== 404) {
      return json({ ok: false, error: 'GitHub read failed ' + get.status }, 502);
    }
    if (!store.players || typeof store.players !== 'object') store.players = {};

    incoming.forEach((row) => {
      const name = String((row && row.name) || '').trim();
      if (!name) return;
      const cur = store.players[name] || blank();
      const add = row.stats || {};
      Object.keys(blank()).forEach((k) => {
        if (k === 'highBid') cur.highBid = Math.max(cur.highBid || 0, add.highBid || 0);
        else cur[k] = (cur[k] || 0) + (Number(add[k]) || 0);
      });
      cur.isBot = !!(row.isBot);
      cur.avatar = row.avatar || cur.avatar || null;
      cur.lastAt = body.at || new Date().toISOString();
      store.players[name] = cur;
    });
    store.updated = new Date().toISOString();
    store.lastMatch = {
      at: body.at || store.updated,
      winner: body.winner || null,
      scores: body.scores || null,
      names: incoming.map((p) => p.name),
    };

    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(store, null, 2))));
    const put = await fetch(api, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'stats: ' + (store.lastMatch.names || []).join(', '),
        content: encoded,
        sha: sha || undefined,
      }),
    });
    if (!put.ok) {
      const err = await put.text();
      return json({ ok: false, error: 'GitHub write failed', detail: err.slice(0, 300) }, 502);
    }
    return json({ ok: true, players: Object.keys(store.players).length });
  },
};

function blank() {
  return {
    hands: 0, bidsWon: 0, highBid: 0, bidSum: 0, bidsMade: 0, bidsSet: 0,
    points: 0, tricksWon: 0, trickPtsSum: 0,
    rookCaptures: 0, red2Captures: 0, bigTricks: 0,
    nestWins: 0, nestPts: 0, moonAttempts: 0, moonMade: 0, bags: 0,
    gamesPlayed: 0, gamesWon: 0,
  };
}
function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
