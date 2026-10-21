import assert from 'node:assert/strict';
import { api, database } from './test-harness.mjs';
const db = database(),
  id = 'x1-reliability',
  sockets = [];
const ctx = { id: { toString: () => id }, storage: db, getWebSockets: () => sockets };
let actor = new api.RoomDO(ctx, {}),
  clock = Date.now(),
  realNow = Date.now;
Date.now = () => clock;
const request = async (path, body, token) => {
  const r = await actor.fetch(
    new Request('https://unit.example' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: 'Bearer ' + token } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  );
  return { status: r.status, data: await r.json() };
};
try {
  const h = (await request('/create', { playerId: 'host', displayName: 'Host' })).data,
    g = (await request('/join', { playerId: 'guest', displayName: 'Guest' })).data;
  await request('/fill-bots', {}, h.token);
  const start = await request(
    '/start',
    { options: { targetScore: 100, shootMoonEnabled: false } },
    h.token
  );
  assert.equal(start.data.phase, 'dealing');
  for (const seat of [h, g])
    sockets.push({
      readyState: 1,
      deserializeAttachment: () => ({ seat: seat.seat, seatToken: seat.token }),
      send(text) {
        const m = JSON.parse(text);
        if (m.snapshot) {
          const all = m.snapshot.hands || [];
          assert.equal(all.length, 0);
          assert(!('x1' in m.snapshot));
          assert(!('plan' in m.snapshot.botIntelligence));
        }
      },
      close() {},
    });
  clock += 30000;
  await actor.alarm();
  let v = (await request('/snapshot', undefined, h.token)).data;
  // Recreate the entire actor after persisted bot scheduling, like eviction.
  for (let guard = 0; guard < 100 && v.currentPlayer > 1; guard++) {
    clock += 30000;
    actor = new api.RoomDO(ctx, {});
    await actor.alarm();
    v = (await request('/snapshot', undefined, h.token)).data;
  }
  assert.equal(v.phase, 'bidding');
  assert(v.currentPlayer <= 1);
  const who = v.currentPlayer === 0 ? h : g,
    original = (await request('/snapshot', undefined, who.token)).data;
  const remembered = structuredClone(db.map.get(id).x1);
  sockets.length = 0;
  // Ten-minute detached client, existing bot alarm loop, no client keepalive.
  clock += 10 * 60 * 1000;
  actor = new api.RoomDO(ctx, {});
  await actor.alarm();
  const resumed = (
    await request('/join', {
      playerId: who === h ? 'host' : 'guest',
      displayName: 'Resume',
      resumeToken: who.token,
    })
  ).data;
  assert.equal(resumed.seat, who.seat);
  assert.equal(resumed.token, who.token);
  const after = (await request('/snapshot', undefined, who.token)).data;
  assert.deepEqual(after.hand, original.hand);
  assert.equal(after.currentPlayer, original.currentPlayer);
  assert.deepEqual(db.map.get(id).x1, remembered);
  const a = {
    actionId: 'lost-response-bid',
    expectedRevision: after.revision,
    value: after.highestBid < 100 ? 100 : 0,
  };
  const first = await request('/bid', a, who.token);
  assert.equal(first.status, 200);
  const stable = structuredClone(db.map.get(id));
  // Response lost: repeat exact request after actor recreation.
  actor = new api.RoomDO(ctx, {});
  const repeat = await request('/bid', a, who.token);
  assert.equal(repeat.status, 200);
  assert.equal(repeat.data.duplicate, true);
  assert.deepEqual(db.map.get(id), stable);
  const bad = await request('/bid', { ...a, actionId: 'delayed-old-revision' }, who.token);
  assert.notEqual(bad.status, 200);
  assert(['STALE_REVISION', 'NOT_YOUR_TURN'].includes(bad.data.error));
  const beforeAuth = structuredClone(db.map.get(id));
  const denied = await request('/snapshot', undefined, 'wrong-token');
  assert.notEqual(denied.status, 200);
  assert.deepEqual(db.map.get(id), beforeAuth);
  // More than the documented idle lifetime intentionally expires a dormant room.
  clock += 61 * 60 * 1000;
  await actor.alarm();
  assert.equal(db.map.has(id), false);
  console.log(
    JSON.stringify({
      pass: true,
      persistedActorRecreation: true,
      tenMinuteDetach: true,
      sameSeatTokenAndHand: true,
      lostResponseExactlyOnce: true,
      staleAndUnauthorizedRejected: true,
      documentedIdleExpiry: true,
      scope: 'Actual RoomDO/alarms with simulated storage and time; not physical mobile or WAN',
    })
  );
} finally {
  Date.now = realNow;
}
