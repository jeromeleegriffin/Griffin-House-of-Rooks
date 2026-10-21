import assert from 'node:assert/strict';
import fs from 'node:fs';
const target = process.env.GHR_X1_TARGET || 'qa';
assert(['qa', 'live'].includes(target));
const base =
  target === 'qa'
    ? 'https://griffin-house-of-rooks-x1-qa-20261021.jeromeleegriffin.workers.dev'
    : 'https://griffin-house-of-rooks-online.jeromeleegriffin.workers.dev';
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const reports = [];
let requests = 0;
for (const spec of target === 'qa'
  ? [
      {humans:1,pace:99,anchor:true},
      {humans:2,pace:3},
      {humans:4,pace:1},
      {humans:1,pace:99,includeRed2:false,anchor:true},
      {humans:1,pace:99,moon:true,anchor:true},
      {humans:1,pace:99,moon:true,includeRed2:false,anchor:true}
    ]
  : [{humans:1,pace:99,moon:true,includeRed2:false,anchor:true}]) {
  let cookie,
    code,
    credentials = [],
    actions = 0,
    rejoins = 0,
    duplicates = 0,
    networkRetries = 0;
  const begun = Date.now();
  const entry = await fetch(base + '/');
  assert.equal(entry.status, 200, 'Native entry failed');
  cookie = entry.headers.get('set-cookie')?.split(';')[0];
  assert(cookie);
  assert((await entry.text()).includes('846-r10-ambience-levels-20261021'));
  async function api(route, method = 'GET', body, token, expected = 200) {
    for (let retry = 0; retry < 4; retry++) {
      requests++;
      const response = await fetch(base + route, {
        method,
        headers: {
          Cookie: cookie,
          Origin: base,
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(20000),
      });
      if (response.status === 429) {
        networkRetries++;
        await response.arrayBuffer();
        await pause(5000);
        continue;
      }
      const data = await response.json();
      assert.equal(
        response.status,
        expected,
        route.split('/').at(-1) + ': ' + (data.error || 'unexpected status')
      );
      return data;
    }
    throw Error('Rate limit persisted after bounded retries');
  }
  try {
    const playerId = crypto.randomUUID(),
      host = await api(
        '/rooms',
        'POST',
        { playerId, displayName: 'X1 QA Host', pace: spec.pace },
        null,
        201
      );
    code = host.roomCode;
    credentials.push({ ...host, playerId });
    const path = '/rooms/' + code;
    for (let seat = 1; seat < spec.humans; seat++) {
      const playerId = crypto.randomUUID(),
        joined = await api(
          path + '/join',
          'POST',
          { playerId, displayName: 'X1 QA Guest ' + seat },
          null,
          201
        );
      credentials.push({ ...joined, playerId });
    }
    if(spec.anchor){const waiting=await api(path+'/snapshot','GET',undefined,host.token);await api(path+'/bot-seat','POST',{seat:2,name:'Anchor',expectedRevision:waiting.revision},host.token);}
    if (spec.humans < 4) await api(path + '/fill-bots', 'POST', {}, host.token);
    let v = await api(
      path + '/start',
      'POST',
      {options:{targetScore:100,shootMoonEnabled:!!spec.moon,includeRed2:spec.includeRed2!==false}},
      host.token
    );
    let readyHand = -1,
      lastRevision = -1;
    const duplicatePhases = new Set(),
      rejoined = new Set();
    // Disconnect between opening/alarms and resume the actual reserved seat.
    const before = v.hand.map((c) => c.id).sort();
    await pause(2000);
    const resumed = await api(
      path + '/join',
      'POST',
      { playerId, displayName: 'X1 QA Resume', resumeToken: host.token },
      null,
      201
    );
    assert.equal(resumed.seat, host.seat);
    assert.equal(resumed.token, host.token);
    rejoins++;
    assert.deepEqual(
      (await api(path + '/snapshot', 'GET', undefined, host.token)).hand.map((c) => c.id).sort(),
      before
    );
    for (let step = 0; step < 1200; step++) {
      assert(Date.now() - begun < 9 * 60 * 1000, 'Hosted match exceeded time budget');
      v = await api(path + '/snapshot', 'GET', undefined, host.token);
      assert(!('hands' in v) && !('x1' in v));
      assert.equal(v.botIntelligence.version,'x1-online-v2');
      if(spec.humans>1)assert.equal(v.botIntelligence.partnerDecisions,0);
      assert(v.revision >= lastRevision);
      lastRevision = v.revision;
      if (v.phase === 'dealing' && readyHand !== v.handNumber) {
        for (const c of credentials)
          await api(
            path + '/ready',
            'POST',
            { handNumber: v.handNumber, openingId: v.opening?.id },
            c.token
          );
        readyHand = v.handNumber;
      }
      if (v.phase === 'complete') break;
      if (v.phase === 'dealing' || v.resolvingTrick || v.trumpOpening) {
        await pause(500);
        continue;
      }
      const actor = ['redeal', 'score'].includes(v.phase)
        ? credentials[0]
        : credentials.find((c) => c.seat === v.currentPlayer);
      if (!actor) {
        await pause(500);
        continue;
      }
      const mine =
        actor.seat === 0 ? v : await api(path + '/snapshot', 'GET', undefined, actor.token);
      if (mine.phase !== v.phase || mine.revision !== v.revision) {
        await pause(100);
        continue;
      }
      if (!rejoined.has(mine.phase + ':' + actor.seat)) {
        const same = await api(
          path + '/join',
          'POST',
          { playerId: actor.playerId, displayName: 'X1 QA Resume', resumeToken: actor.token },
          null,
          201
        );
        assert.equal(same.seat, actor.seat);
        assert.equal(same.token, actor.token);
        const after = await api(path + '/snapshot', 'GET', undefined, actor.token);
        assert.deepEqual(after.hand, mine.hand);
        rejoins++;
        rejoined.add(mine.phase + ':' + actor.seat);
        if (after.revision !== mine.revision) continue;
      }
      let route,
        data = {};
      if (mine.phase === 'bidding') {
        route = 'bid';
        data.value = spec.moon ? (spec.includeRed2===false?180:200) : mine.highestBid < 100 ? 100 : 0;
      } else if (mine.phase === 'discard') {
        route = 'discard';
        data.cardIds = mine.hand.slice(0, mine.discardCount).map((c) => c.id);
      } else if (mine.phase === 'trump') {
        route = 'trump';
        data.color = 'green';
      } else if (mine.phase === 'play') {
        if (mine.canClaimRemaining) route = 'decline-claim';
        else {
          route = 'play';
          const suit = (c) => (c.id === 'rook' || c.id === 'red-2' ? mine.trump : c.color);
          const following = mine.hand.filter((c) => suit(c) === mine.ledColor),
            legal = mine.ledColor && following.length ? following : mine.hand;
          assert(legal.length);
          data.cardId = legal[0].id;
        }
      } else if (mine.phase === 'score') route = 'next-hand';
      else if (mine.phase === 'redeal') route = 'redeal';
      else throw Error('Unexpected phase ' + mine.phase);
      const action = { actionId: crypto.randomUUID(), expectedRevision: mine.revision, ...data };
      const sent = await api(path + '/' + route, 'POST', action, actor.token);
      assert(sent.accepted);
      actions++;
      if (['bid', 'play'].includes(route) && !duplicatePhases.has(route)) {
        const repeat = await api(path + '/' + route, 'POST', action, actor.token);
        assert.equal(repeat.duplicate, true);
        duplicatePhases.add(route);
        duplicates++;
      }
    }
    assert.equal(v.phase, 'complete');
    assert(v.matchResult);
    if (spec.humans < 4) {
      assert(v.botIntelligence.decisions.play > 0);
      assert.equal(v.botIntelligence.fallbacks,0,JSON.stringify(v.botIntelligence));
      if(spec.humans===1)assert(v.botIntelligence.partnerDecisions>0,'Sole-human partner assistance not exercised');
      if(spec.moon||spec.includeRed2===false)assert(v.botIntelligence.ruleDecisions>0,'Expanded rules were not exercised');
      assert(v.botIntelligence.maxDecisionMs < 2000, 'X1 decision responsiveness exceeded budget');
    }
    const report = {
      moon:!!spec.moon,includeRed2:spec.includeRed2!==false,
      humans: spec.humans,
      bots: 4 - spec.humans,
      pace: spec.pace,
      phase: v.phase,
      scores: v.scores,
      actions,
      rejoins,
      duplicates,
      networkRetries,
      elapsedMs: Date.now() - begun,
      intelligence: v.botIntelligence,
    };
    reports.push(report);
    console.log(JSON.stringify(report));
  } finally {
    if (code && credentials[0])
      await api('/rooms/' + code + '/close', 'POST', {}, credentials[0].token);
  }
}
assert(reports.some((r) => r.intelligence.decisions.play > 0));
const result = {
  target,
  scope:
    'Real Cloudflare HTTP API from one GitHub runner; simulated identities, not independent physical devices or rendered browser',
  requests,
  matches: reports.length,
  reports,
};
fs.mkdirSync('x1-evidence', { recursive: true });
fs.writeFileSync('x1-evidence/hosted-results.json', JSON.stringify(result, null, 2));
