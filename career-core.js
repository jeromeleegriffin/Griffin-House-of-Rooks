/* Local Career v2. Single-key canonical commits; validated, journaled recovery.
 * No server, telemetry or credentials. Existing career points remain the level currency.
 */
(function (root) {
  'use strict';
  const KEY = 'horCareerStateV2',
    JOURNAL = 'horCareerRestoreV2',
    ACTOR = 'horLocalCareerActorV1',
    MODE = 'horProgressModeV1';
  const RETIRED = /^(rook_hunter_[1-5]|bird_two_[1-5]|first_rook|bird_two_one)$/;
  const EXACT = new Set([
    'horAudioMixerV1',
    'rookLifetimeStats',
    ACTOR,
    MODE,
    'horProgressHumanNameV1',
    'horProgressMigrationV1',
    'horProgressPresentationV1',
    'horFriendlyRecoveryCodeV1',
    'horLastCareerBackupV1',
    KEY,
    'griffinHousePlayerName',
    'griffinHousePlayerAvatar',
    'griffinHousePlayerVoice',
    'horFavoritePartner042',
    'horHolderCueVibrationV1',
    'horLandingIdentityV1',
    'horFavoritePartnersV1',
    'horFounderPreviousHumanV1',
    'horFounderVoiceV1',
    'horLegacyAvatarBefore783',
    'rookMuted',
    'rookSoundTurn',
    'rookTurnSoundChoice',
    'rookReduceMotion',
    'rookHighContrast',
    'horCardStyle',
    'horGamePace',
    'horAvatarMotion',
    'horHandSortMode',
    'horPlaqueA',
    'horPlaqueB',
    'horOtherCareerPopups',
    'horPrefs',
    'rookCabinVolume041',
    'rookCabinAmbience041',
    'rookFireVolume758',
    'rookOwls758',
    'rookTheme',
    'rookCardBack',
    'rookTopOptsCollapsed',
    'horLobbyHero',
  ]);
  const PREFIX = ['horCareerLedgerV1:', 'horProgressV1:', 'horBotRelationshipV1:'];
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const plain = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const now = () => new Date().toISOString();
  const uuid = () =>
    root.crypto.randomUUID
      ? root.crypto.randomUUID()
      : Array.from(root.crypto.getRandomValues(new Uint32Array(4)), (n) =>
          n.toString(16).padStart(8, '0')
        ).join('');
  function stable(x) {
    if (Array.isArray(x)) return '[' + x.map(stable).join(',') + ']';
    if (plain(x))
      return (
        '{' +
        Object.keys(x)
          .sort()
          .map((k) => JSON.stringify(k) + ':' + stable(x[k]))
          .join(',') +
        '}'
      );
    return JSON.stringify(x);
  }
  function digest(value) {
    // SHA-256; UTF-8; corruption detection, not authentication.
    const bytes = new TextEncoder().encode(typeof value === 'string' ? value : stable(value));
    const len = bytes.length;
    const data = new Uint8Array(Math.ceil((len + 9) / 64) * 64);
    data.set(bytes);
    data[len] = 128;
    const view = new DataView(data.buffer);
    view.setUint32(data.length - 4, (len * 8) >>> 0);
    view.setUint32(data.length - 8, Math.floor(len / 0x20000000));
    const h = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
      0x5be0cd19,
    ];
    const k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
      0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
      0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
      0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
      0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
      0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
      0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
      0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
      0xc67178f2,
    ];
    const rr = (x, n) => (x >>> n) | (x << (32 - n)),
      w = new Uint32Array(64);
    for (let off = 0; off < data.length; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        let x = w[i - 15],
          y = w[i - 2];
        w[i] =
          (w[i - 16] +
            (rr(x, 7) ^ rr(x, 18) ^ (x >>> 3)) +
            w[i - 7] +
            (rr(y, 17) ^ rr(y, 19) ^ (y >>> 10))) >>>
          0;
      }
      let [a, b, c, d, e, f, g, t] = h;
      for (let i = 0; i < 64; i++) {
        let u = (t + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + k[i] + w[i]) >>> 0;
        let v = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        t = g;
        g = f;
        f = e;
        e = (d + u) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (u + v) >>> 0;
      }
      [a, b, c, d, e, f, g, t].forEach((x, i) => (h[i] = (h[i] + x) >>> 0));
    }
    return h.map((x) => x.toString(16).padStart(8, '0')).join('');
  }
  function install(P) {
    const storage = root.localStorage;
    function parse(raw, fallback) {
      return raw == null ? fallback : JSON.parse(raw);
    }
    function get(k, fallback) {
      return parse(storage.getItem(k), fallback);
    }
    function allowed(k) {
      return EXACT.has(k) || PREFIX.some((p) => k.startsWith(p));
    }
    function collect() {
      const out = {};
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (allowed(k)) out[k] = storage.getItem(k);
      }
      return out;
    }
    function numeric(stats) {
      const s = {};
      for (const [k, v] of Object.entries(stats || {}))
        if (typeof v === 'number') {
          if (!Number.isSafeInteger(v) || v < 0) throw Error('Invalid career counter: ' + k);
          s[k] = v;
        }
      return s;
    }
    function checkStats(s) {
      if (!plain(s)) throw Error('Missing career statistics');
      for (const [k, v] of Object.entries(s))
        if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0)
          throw Error('Invalid career counter: ' + k);
      if (
        (s.gamesWon || 0) > (s.gamesPlayed || 0) ||
        (s.bidsMade || 0) + (s.bidsSet || 0) > (s.bidsWon || 0)
      )
        throw Error('Inconsistent career counters');
      return s;
    }
    function checkState(s) {
      const int = (n) => Number.isSafeInteger(n) && n >= 0,
        str = (n) => typeof n === 'string' && n.length > 0;
      if (
        !plain(s) ||
        s.schemaVersion !== 2 ||
        s.migrationVersion !== 2 ||
        !plain(s.identity) ||
        !str(s.identity.id) ||
        !Array.isArray(s.identity.aliases) ||
        s.identity.aliases.some((n) => !str(n)) ||
        !str(s.identity.displayName) ||
        !plain(s.records) ||
        !s.records.human ||
        !plain(s.receipts) ||
        !plain(s.matches) ||
        !plain(s.sources) ||
        !Array.isArray(s.conflicts) ||
        !int(s.revision) ||
        s.revision < 1 ||
        !plain(s.migration) ||
        s.migration.completed !== true ||
        !Number.isFinite(Date.parse(s.updatedAt))
      )
        throw Error('Invalid Career v2 state');
      for (const [key, r] of Object.entries(s.records)) {
        if (
          !plain(r) ||
          !str(r.displayName) ||
          typeof r.isBot !== 'boolean' ||
          (key === 'human' ? r.isBot : !key.startsWith('bot:') || !r.isBot)
        )
          throw Error('Invalid career owner');
        checkStats(r.stats);
        for (const key of [
          'achievements',
          'retiredAchievements',
          'rewardReceipts',
          'partners',
          'trumpWins',
        ])
          if (!plain(r[key])) throw Error('Incomplete career record');
        for (const [id, a] of Object.entries({ ...r.achievements, ...r.retiredAchievements })) {
          if (!plain(a) || !plain(r.rewardReceipts[id])) throw Error('Missing achievement receipt');
        }
        for (const reward of Object.values(r.rewardReceipts))
          if (!plain(reward) || reward.xp !== 0) throw Error('Invalid achievement reward');
        for (const p of Object.values(r.partners))
          if (!plain(p) || !str(p.name) || !int(p.wins) || !int(p.games) || p.wins > p.games)
            throw Error('Invalid partnership history');
        for (const color of ['black', 'red', 'green', 'yellow'])
          if (!int(r.trumpWins[color])) throw Error('Invalid trump history');
      }
      for (const [id, r] of Object.entries(s.receipts))
        if (
          !id.startsWith('hand:') ||
          !plain(r) ||
          typeof r.hash !== 'string' ||
          !/^[a-f0-9]{64}$/.test(r.hash)
        )
          throw Error('Invalid hand receipt');
      for (const [id, m] of Object.entries(s.matches)) {
        if (
          !str(id) ||
          !plain(m) ||
          !int(m.hand) ||
          !Array.isArray(m.stats) ||
          m.stats.length !== 4 ||
          !Array.isArray(m.extras) ||
          m.extras.length !== 4 ||
          !Array.isArray(m.lowScoreGap) ||
          m.lowScoreGap.length !== 2 ||
          m.lowScoreGap.some((n) => !int(n)) ||
          typeof m.completed !== 'boolean'
        )
          throw Error('Invalid match history');
        for (const stats of m.stats) checkStats(stats);
      }
      return s;
    }
    function read() {
      const s = get(KEY, null);
      if (s && storage.getItem(ACTOR) && storage.getItem(ACTOR) !== s.identity?.id)
        throw Error('Career identity conflict');
      return s ? checkState(s) : null;
    }
    function put(s) {
      checkState(s);
      const value = JSON.stringify(s);
      storage.setItem(KEY, value);
      if (storage.getItem(KEY) !== value) throw Error('Career save verification failed');
      return s;
    }
    function commit(s) {
      s.revision++;
      s.updatedAt = now();
      return put(s);
    }
    function actorId() {
      const s = read();
      const old = storage.getItem(ACTOR);
      if (s) {
        if (old && old !== s.identity.id) throw Error('Career identity conflict');
        if (!old) storage.setItem(ACTOR, s.identity.id);
        return s.identity.id;
      }
      if (old) return old;
      const id = 'local-' + uuid();
      storage.setItem(ACTOR, id);
      return id;
    }
    function botId(name) {
      return (
        'bot-' +
        String(name || 'bot')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      );
    }
    function blank(name, isBot = false) {
      return {
        displayName: name,
        isBot,
        stats: {},
        achievements: {},
        retiredAchievements: {},
        rewardReceipts: {},
        partners: {},
        trumpWins: { black: 0, red: 0, green: 0, yellow: 0 },
        avatar: null,
      };
    }
    function award(r, origin) {
      const unlocked = P.evaluate(r.stats, r.achievements);
      for (const a of unlocked) {
        r.achievements[a.id] = { unlockedAt: now(), type: a.type, tier: a.tier || null, origin };
        r.rewardReceipts[a.id] = {
          xp: 0,
          reason: 'Achievements have no separate point bonus in the approved level system',
          origin,
        };
      }
      return unlocked;
    }
    function preserveAwards(r, old) {
      for (const [id, a] of Object.entries(old || {})) {
        if (RETIRED.test(id)) r.retiredAchievements[id] = copy(a);
        else r.achievements[id] = copy(a);
        r.rewardReceipts[id] = { xp: 0, origin: 'legacy-import', previousRewardUnknown: true };
      }
    }
    function dominates(a, b) {
      return Object.entries(b).every(
        ([k, v]) => ['currentWinStreak', 'currentMadeBidStreak'].includes(k) || (a[k] || 0) >= v
      );
    }
    function migrate(opts = {}) {
      const existing = read();
      if (existing) return existing;
      const store = get('rookLifetimeStats', {});
      if (!plain(store)) throw Error('Invalid legacy store');
      const id = actorId(),
        ledger = get('horCareerLedgerV1:human:' + id, null);
      const humans = Object.entries(store).filter(([, r]) => r && !r.isBot);
      const named = humans.filter(
        ([n]) => !['you', 'host', 'player'].includes(n.trim().toLowerCase())
      );
      const selected = get('horLandingIdentityV1', null)?.name;
      const preferred =
        opts.displayName ||
        selected ||
        (named.length === 1
          ? named[0][0]
          : ledger?.displayName || storage.getItem('horProgressHumanNameV1')) ||
        opts.newPlayerName ||
        'You';
      const aliases = new Set(opts.aliases || [preferred]);
      // A default-name row is considered an overlapping local snapshot, never an additive career.
      if (named.length <= 1) for (const [n] of humans) aliases.add(n);
      const s = {
        schemaVersion: 2,
        migrationVersion: 2,
        identity: { id, displayName: preferred, aliases: [...aliases].sort() },
        revision: 1,
        updatedAt: now(),
        records: { human: blank(preferred) },
        receipts: {},
        matches: {},
        sources: {},
        conflicts: [],
        migration: {
          completed: true,
          at: now(),
          policy: 'whole-snapshot-baseline; ambiguous increments quarantined; no sums',
        },
        restores: {},
      };
      const candidates = [];
      for (const [name, rec] of humans) {
        checkStats(numeric(rec));
        s.sources['legacy:' + name] = copy(rec);
        if (aliases.has(name)) candidates.push({ name, stats: numeric(rec), record: rec });
        else s.conflicts.push({ kind: 'unbound-human', source: name });
      }
      if (ledger) {
        checkStats(numeric(ledger.stats));
        candidates.push({
          name: ledger.displayName || preferred,
          stats: numeric(ledger.stats),
          record: ledger,
          ledger: true,
        });
        s.sources['human-ledger'] = copy(ledger);
      }
      const ordered = candidates.sort(
        (a, b) =>
          Number(b.name === preferred) - Number(a.name === preferred) ||
          Number(a.ledger) - Number(b.ledger) ||
          a.name.localeCompare(b.name)
      );
      let chosen =
        ordered.find((a) => ordered.every((b) => dominates(a.stats, b.stats))) || ordered[0];
      if (chosen) {
        s.records.human.stats = copy(chosen.stats);
        s.records.human.avatar =
          storage.getItem('griffinHousePlayerAvatar') ||
          chosen.record.avatar ||
          ledger?.avatar ||
          null;
        s.migration.baselineSource = chosen.ledger ? 'human-ledger' : 'legacy:' + chosen.name;
      }
      for (const c of ordered)
        if (c !== chosen && stable(c.stats) !== stable(chosen.stats))
          s.conflicts.push({
            kind: 'overlapping-legacy-snapshot',
            source: c.ledger ? 'human-ledger' : 'legacy:' + c.name,
            disposition: 'preserved-not-added',
          });
      if (ledger) preserveAwards(s.records.human, ledger.achievements);
      for (const [name, rec] of Object.entries(store)) {
        if (!rec?.isBot) continue;
        const key = 'bot:' + botId(name),
          r = blank(name, true);
        r.stats = numeric(rec);
        r.avatar = rec.avatar || null;
        const old = get('horCareerLedgerV1:bot:' + botId(name), null);
        if (old) {
          const prior = numeric(old.stats);
          checkStats(prior);
          if (dominates(prior, r.stats)) r.stats = prior;
          else if (!dominates(r.stats, prior))
            s.conflicts.push({
              kind: 'overlapping-bot-snapshot',
              source: 'bot-ledger:' + botId(name),
              disposition: 'preserved-not-added',
            });
          preserveAwards(r, old.achievements);
          s.sources['bot-ledger:' + botId(name)] = copy(old);
        }
        s.records[key] = r;
      }
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key.startsWith('horProgressV1:')) s.sources[key] = get(key, {});
      }
      // Relationship records have their own cumulative semantics; do not turn aggregate wins into streaks.
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key.startsWith('horBotRelationshipV1:')) continue;
        const rel = get(key, {}),
          name = key.slice('horBotRelationshipV1:'.length);
        const wins = rel.partnerWins || 0,
          games = rel.partnerGames || 0;
        if (!Number.isSafeInteger(wins) || !Number.isSafeInteger(games) || wins < 0 || wins > games)
          throw Error('Invalid partnership history');
        s.records.human.partners[botId(name)] = { name, games, wins };
      }
      for (const r of Object.values(s.records)) {
        const wins = Math.max(0, ...Object.values(r.partners).map((p) => p.wins));
        if (wins) {
          r.stats.bestPartnerWins = Math.max(r.stats.bestPartnerWins || 0, wins);
          r.stats.samePartnerWins = Math.max(r.stats.samePartnerWins || 0, wins);
        }
        award(r, 'verified-cumulative-baseline');
      }
      put(s);
      return s;
    }
    function mode() {
      return storage.getItem(MODE) === 'local' ? 'local' : 'preview';
    }
    function activate(opts) {
      const s = migrate(opts);
      storage.setItem(MODE, 'local');
      P.CONFIG.enabled =
        P.CONFIG.uiEnabled =
        P.CONFIG.notificationsEnabled =
        P.CONFIG.botProgressionEnabled =
          true;
      return {
        ok: true,
        mode: 'local',
        migration: { rows: Object.values(s.records) },
        recoveryCode: storage.getItem('horFriendlyRecoveryCodeV1') || null,
      };
    }
    function rename(name, avatar) {
      if (typeof name !== 'string' || !name.trim()) throw Error('Player name is required');
      const s = migrate();
      name = name.trim();
      if (!s.identity.aliases.includes(name)) s.identity.aliases.push(name);
      s.identity.displayName = name;
      s.records.human.displayName = name;
      if (avatar !== undefined) s.records.human.avatar = avatar;
      commit(s);
      return s;
    }
    function ledgerRead(type, id) {
      const s = read();
      if (s) {
        if (type === 'human' && id !== s.identity.id) throw Error('Career identity conflict');
        return copy(s.records[type === 'human' ? 'human' : 'bot:' + id] || blank('Bot', true));
      }
      return get('horCareerLedgerV1:' + type + ':' + id, { stats: {}, achievements: {} });
    }
    function sync(store) {
      if (mode() !== 'local') return { ok: false, reason: 'preview-mode' };
      const s = migrate();
      return {
        ok: true,
        rows: Object.values(s.records),
        source: 'canonical-v2',
        legacySnapshotsIgnored: true,
      };
    }
    function profile(type = 'human', id, displayName) {
      const s = read();
      if (mode() !== 'local' || !s) return null;
      /* A new bot has a zero-point career before its first recorded hand. Project it without writing or replacing saved history. */ const r =
        s.records[type === 'human' ? 'human' : 'bot:' + id] ||
        (type === 'bot' &&
        typeof displayName === 'string' &&
        displayName.trim() &&
        botId(displayName) === id
          ? blank(displayName.trim(), true)
          : null);
      if (!r) return null;
      const stats = r.stats,
        lv = P.levelFor(stats.points || 0);
      return {
        ...copy(stats),
        enabled: true,
        isBot: !!r.isBot,
        displayName: r.displayName,
        avatar:
          type === 'human' ? storage.getItem('griffinHousePlayerAvatar') || r.avatar : r.avatar,
        careerRef: digest(s.identity.id).slice(0, 16),
        level: lv.level,
        title: lv.title,
        points: stats.points || 0,
        xp: stats.points || 0,
        nextThreshold: lv.nextThreshold,
        gamesPlayed: stats.gamesPlayed || 0,
        gamesWon: stats.gamesWon || 0,
        achievementCount: Object.keys(r.achievements).length,
        retiredAchievementCount: Object.keys(r.retiredAchievements).length,
        achievements: Object.keys(r.achievements),
        partners: copy(r.partners),
        retiredAchievements: copy(r.retiredAchievements),
      };
    }
    function applyDelta(r, delta) {
      for (const [k, v] of Object.entries(delta)) {
        if (!Number.isSafeInteger(v) || v < 0) throw Error('Invalid event delta: ' + k);
        if (k === 'highBid' || k.startsWith('best') || k.startsWith('longest'))
          r.stats[k] = Math.max(r.stats[k] || 0, v);
        else r.stats[k] = (r.stats[k] || 0) + v;
      }
    }
    function recordHand(ev) {
      // Lifetime accounting is independent of the optional Career display switch.
      if (
        !plain(ev) ||
        typeof ev.matchId !== 'string' ||
        !ev.matchId ||
        !Number.isInteger(ev.hand) ||
        ev.hand < 1 ||
        !Array.isArray(ev.players) ||
        ev.players.length !== 4 ||
        !Array.isArray(ev.stats) ||
        ev.stats.length !== 4 ||
        !plain(ev.summary)
      )
        throw Error('Invalid hand event');
      if (
        !Number.isInteger(ev.bidder) ||
        ev.bidder < 0 ||
        ev.bidder > 3 ||
        !Number.isInteger(ev.tricksPerHand) ||
        ev.tricksPerHand < 1 ||
        !['black', 'red', 'green', 'yellow'].includes(ev.summary.trump) ||
        !Array.isArray(ev.summary.scores) ||
        ev.summary.scores.length !== 2 ||
        ev.summary.scores.some((n) => !Number.isSafeInteger(n)) ||
        ['pointsA', 'pointsB', 'bid'].some(
          (k) => !Number.isSafeInteger(ev.summary[k]) || ev.summary[k] < 0
        ) ||
        typeof ev.summary.made !== 'boolean' ||
        (ev.winnerTeam != null && ![0, 1].includes(ev.winnerTeam))
      )
        throw Error('Invalid hand outcome');
      const s = migrate({
          newPlayerName: ev.players.find((p) => p && !p.isBot && p.id === ev.localPeerId)?.name,
        }),
        receipt = 'hand:' + ev.matchId + ':' + ev.hand,
        fingerprint = digest({ ...ev, localPeerId: undefined, isHost: undefined }),
        oldReceipt = s.receipts[receipt];
      if (oldReceipt) {
        if (oldReceipt.hash !== fingerprint) throw Error('Conflicting duplicate hand event');
        return { ok: true, duplicate: true };
      }
      const match = s.matches[ev.matchId] || {
        hand: 0,
        stats: [{}, {}, {}, {}],
        extras: [{}, {}, {}, {}],
        lowScoreGap: [0, 0],
        completed: false,
      };
      if (match.completed || ev.hand <= match.hand) throw Error('Stale hand event');
      if (ev.hand !== match.hand + 1)
        throw Error('Missing hand history: refusing incomplete statistics');
      const humans = ev.players.filter((p) => p && !p.isBot && p.id === ev.localPeerId);
      if (humans.length !== 1) throw Error('Local human identity unresolved');
      const unlocks = [],
        notifications = [];
      for (let i = 0; i < 4; i++) {
        const p = ev.players[i];
        if (!p || (!p.isBot && p.id !== ev.localPeerId) || (p.isBot && !ev.isHost)) continue;
        const key = p.isBot ? 'bot:' + botId(p.name) : 'human',
          r = s.records[key] || (s.records[key] = blank(p.name, true));
        if (!p.isBot) {
          if (!s.identity.aliases.includes(p.name)) s.identity.aliases.push(p.name);
          r.displayName =
            s.identity.displayName; /* Game's generic You must not rename the selected career. */
        } else r.displayName = p.name;
        r.avatar = p.avatar || r.avatar;
        const oldLevel = P.levelFor(r.stats.points || 0);
        const current = checkStats(ev.stats[i]),
          previous = match.stats[i] || {},
          delta = {};
        for (const [k, v] of Object.entries(current)) {
          if (k === 'gamesPlayed' || k === 'gamesWon') continue;
          if (k === 'highBid') delta[k] = v;
          else {
            delta[k] = v - (previous[k] || 0);
            if (delta[k] < 0) throw Error('Match counter rollback');
          }
        }
        applyDelta(r, delta);
        const extra = ev.extras?.[i] || {};
        for (const [k, v] of Object.entries(extra)) {
          if (k === 'trumpWins') continue;
          if (typeof v === 'number') {
            const before = match.extras[i]?.[k] || 0;
            applyDelta(r, { [k]: k.startsWith('best') ? v : v - before });
          }
        }
        if (i === ev.bidder) {
          const made = !!ev.summary.made;
          r.stats.currentMadeBidStreak = made ? (r.stats.currentMadeBidStreak || 0) + 1 : 0;
          r.stats.longestMadeBidStreak = Math.max(
            r.stats.longestMadeBidStreak || 0,
            r.stats.currentMadeBidStreak
          );
          if (made) {
            const pts = p.team === 0 ? ev.summary.pointsA : ev.summary.pointsB;
            if (pts === ev.summary.bid) r.stats.exactBidMakes = (r.stats.exactBidMakes || 0) + 1;
            if (ev.summary.bid >= 180) r.stats.highRollerMade = (r.stats.highRollerMade || 0) + 1;
            const color = ev.summary.trump;
            if (Object.hasOwn(r.trumpWins, color)) r.trumpWins[color]++;
            r.stats.allTrumpColorWins = Math.min(...Object.values(r.trumpWins));
          }
        }
        const handPoints = p.team === 0 ? ev.summary.pointsA : ev.summary.pointsB;
        r.stats.bestHandPoints = Math.max(r.stats.bestHandPoints || 0, handPoints);
        // Solo sweeps use actual personal trick victories, not team counter totals.
        if (delta.tricksWon === ev.tricksPerHand)
          r.stats.sweepHands = (r.stats.sweepHands || 0) + 1;
        if (ev.completed || ev.winnerTeam != null) {
          const won = p.team === ev.winnerTeam;
          r.stats.gamesPlayed = (r.stats.gamesPlayed || 0) + 1;
          r.stats.gamesWon = (r.stats.gamesWon || 0) + Number(won);
          r.stats.currentWinStreak = won ? (r.stats.currentWinStreak || 0) + 1 : 0;
          r.stats.longestWinStreak = Math.max(
            r.stats.longestWinStreak || 0,
            r.stats.currentWinStreak
          );
          const margin = Math.abs(ev.summary.scores[0] - ev.summary.scores[1]);
          if (won) {
            if (margin <= 5) r.stats.closeWins = (r.stats.closeWins || 0) + 1;
            if (margin >= 200) r.stats.routWins = (r.stats.routWins || 0) + 1;
            if (match.lowScoreGap[p.team] >= 100)
              r.stats.comebackWins = (r.stats.comebackWins || 0) + 1;
          }
          const partner = ev.players.find((q, j) => j !== i && q.team === p.team);
          if (partner?.isBot) {
            const pid = botId(partner.name),
              rel =
                r.partners[pid] || (r.partners[pid] = { name: partner.name, games: 0, wins: 0 });
            rel.games++;
            rel.wins += Number(won);
            const max = Math.max(0, ...Object.values(r.partners).map((p) => p.wins));
            r.stats.bestPartnerWins = Math.max(r.stats.bestPartnerWins || 0, max);
            r.stats.samePartnerWins = Math.max(r.stats.samePartnerWins || 0, max);
          }
        }
        const earned = award(r, receipt);
        unlocks.push(...earned);
        const level = P.levelFor(r.stats.points || 0);
        if (level.level > oldLevel.level)
          notifications.push({
            human: !p.isBot,
            careerRef: digest(s.identity.id).slice(0, 16),
            kind: 'level',
            icon: '★',
            kicker: 'Level Up',
            title: 'Level ' + level.level + ' — ' + level.title,
            subtitle:
              r.displayName + ' reached ' + r.stats.points.toLocaleString() + ' career points.',
            major: level.level % 5 === 0,
          });
        for (const a of earned)
          notifications.push({
            human: !p.isBot,
            careerRef: digest(s.identity.id).slice(0, 16),
            icon: a.medal === 'Griffin' ? '🦅' : '🏆',
            kicker:
              a.type === 'feat'
                ? 'Rare Feat'
                : a.medal === 'Griffin'
                  ? 'Griffin Medal Earned'
                  : 'Achievement Unlocked',
            title: a.name + (a.medal ? ' — ' + a.medal : ''),
            subtitle: r.displayName,
            major: a.type === 'feat' || a.medal === 'Griffin',
          });
        checkStats(r.stats);
      }
      match.hand = ev.hand;
      match.stats = copy(ev.stats);
      match.extras = copy(ev.extras || [{}, {}, {}, {}]);
      match.completed = !!ev.completed || ev.winnerTeam != null;
      for (let t = 0; t < 2; t++)
        match.lowScoreGap[t] = Math.max(
          match.lowScoreGap[t],
          ev.summary.scores[1 - t] - ev.summary.scores[t]
        );
      s.matches[ev.matchId] = match;
      s.receipts[receipt] = { hash: fingerprint, pointsCurrency: 'career-points', at: now() };
      commit(s);
      if (P.CONFIG.notificationsEnabled)
        for (const n of notifications)
          try {
            if (n.human) {
              P.presentation?.enqueue(n);
              root.horCareerLocalAnnouncement?.(n);
            }
          } catch (_) {}
      return { ok: true, unlocks };
    }
    function validateBackup(x) {
      if (
        !plain(x) ||
        x.format !== 'GriffinHouseOfRooksCareerBackup' ||
        ![1, 2].includes(x.version) ||
        !plain(x.data) ||
        typeof x.createdAt !== 'string' ||
        !Number.isFinite(Date.parse(x.createdAt))
      )
        throw Error('Invalid or unsupported career backup');
      if (
        x.version === 2 &&
        (!plain(x.integrity) ||
          x.integrity.algorithm !== 'SHA-256' ||
          x.integrity.value !==
            digest({ format: x.format, version: x.version, createdAt: x.createdAt, data: x.data }))
      )
        throw Error('Backup integrity mismatch');
      if (!Object.hasOwn(x.data, 'rookLifetimeStats') && !Object.hasOwn(x.data, KEY))
        throw Error('Backup is missing career statistics');
      for (const [k, v] of Object.entries(x.data)) {
        if (!allowed(k) || typeof v !== 'string') throw Error('Invalid backup storage field');
        if (k === KEY) checkState(parse(v));
        else if (k === 'rookLifetimeStats') {
          const rows = parse(v);
          if (!plain(rows)) throw Error('Invalid lifetime statistics');
          for (const r of Object.values(rows)) {
            if (!plain(r) || typeof r.isBot !== 'boolean') throw Error('Invalid legacy player');
            checkStats(numeric(r));
            for (const [n, value] of Object.entries(r))
              if (!['isBot', 'avatar', 'botStyle'].includes(n) && typeof value !== 'number')
                throw Error('Invalid legacy counter type');
          }
        } else if (k.startsWith('horCareerLedgerV1:')) {
          const r = parse(v);
          if (!plain(r) || !plain(r.stats) || !plain(r.achievements) || r.schemaVersion !== 1)
            throw Error('Invalid legacy ledger');
          checkStats(r.stats);
        } else if (
          k.startsWith('horProgressV1:') ||
          k.startsWith('horBotRelationshipV1:') ||
          k === 'horProgressPresentationV1' ||
          [
            'horPrefs',
            'horLandingIdentityV1',
            'horFounderPreviousHumanV1',
            'horFavoritePartnersV1',
          ].includes(k)
        ) {
          if (!plain(parse(v))) throw Error('Invalid career preferences');
        }
      }
      if (
        x.data.horLandingIdentityV1 &&
        typeof parse(x.data.horLandingIdentityV1).name !== 'string'
      )
        throw Error('Invalid saved player name');
      const state = x.data[KEY] ? parse(x.data[KEY]) : null;
      if (state && x.data[ACTOR] && state.identity.id !== x.data[ACTOR])
        throw Error('Backup identity mismatch');
      if (
        (state || Object.keys(x.data).some((k) => k.startsWith('horCareerLedgerV1:human:'))) &&
        !x.data[ACTOR]
      )
        throw Error('Missing human identity');
      if (x.data[MODE] && !['local', 'preview'].includes(x.data[MODE]))
        throw Error('Invalid career mode');
      return x;
    }
    function buildBackup() {
      const data = collect();
      if (!data.rookLifetimeStats && !data[KEY]) data.rookLifetimeStats = '{}';
      const x = {
        format: 'GriffinHouseOfRooksCareerBackup',
        version: 2,
        createdAt: now(),
        data,
        recoveryCode: storage.getItem('horFriendlyRecoveryCodeV1') || null,
      };
      x.integrity = {
        algorithm: 'SHA-256',
        value: digest({ format: x.format, version: x.version, createdAt: x.createdAt, data }),
      };
      validateBackup(x);
      return x;
    }
    function recover() {
      const raw = storage.getItem(JOURNAL);
      if (!raw) return { pending: false };
      const j = parse(raw);
      if (
        !plain(j) ||
        j.version !== 2 ||
        !plain(j.before) ||
        !plain(j.after) ||
        j.hash !== digest(j.after) ||
        j.beforeHash !== digest(j.before) ||
        !['prepared', 'committed'].includes(j.phase)
      )
        throw Error('Recovery journal damaged; saved data retained');
      const target = j.phase === 'committed' ? j.after : j.before;
      const keys = new Set([...Object.keys(j.before), ...Object.keys(j.after)]);
      for (const k of keys) {
        if (!allowed(k)) throw Error('Invalid recovery journal');
        if (Object.hasOwn(target, k)) storage.setItem(k, target[k]);
        else storage.removeItem(k);
      }
      storage.removeItem(JOURNAL);
      return { pending: false, recovered: j.phase === 'committed' ? 'completed' : 'rolled-back' };
    }
    // Always-on careers initialize a blank identity before the owner can choose Restore.
    // Only this receipt-free, source-free starter may adopt an explicitly selected backup.
    function emptyStarter(s) {
      return (
        !!s &&
        !Object.keys(s.receipts).length &&
        !Object.keys(s.matches).length &&
        !Object.keys(s.sources).length &&
        !s.conflicts.length &&
        Object.values(s.records).every(
          (r) =>
            Object.values(r.stats).every((v) => v === 0) &&
            !Object.keys(r.achievements).length &&
            !Object.keys(r.retiredAchievements).length &&
            !Object.keys(r.rewardReceipts).length &&
            !Object.keys(r.partners).length &&
            Object.values(r.trumpWins).every((v) => v === 0)
        )
      );
    }
    function restoreBackupObject(input) {
      recover();
      const x = validateBackup(copy(input)),
        before = collect(),
        after = { ...before, ...x.data };
      let current = read();
      const incoming = x.data[KEY] ? parse(x.data[KEY]) : null,
        starter = emptyStarter(current);
      if (starter) current = null;
      if (starter && !incoming) {
        delete after[KEY];
        if (!x.data[ACTOR]) delete after[ACTOR];
      }
      const ownId = current?.identity.id || storage.getItem(ACTOR),
        newId = incoming?.identity.id || x.data[ACTOR];
      if (!starter && ownId && newId && ownId !== newId)
        throw Error('Identity conflict: this backup belongs to a different local career');
      if (current) {
        if (!incoming)
          throw Error('Legacy restore would replace a migrated career; preserved without changes');
        if (stable(incoming) === stable(current) && stable(after) === stable(before))
          return { ok: true, duplicate: true, restored: 0 };
        if (
          current.identity.aliases.some((a) => !incoming.identity.aliases.includes(a)) ||
          Object.entries(current.sources).some(
            ([k, v]) => stable(incoming.sources[k]) !== stable(v)
          )
        )
          throw Error('Backup would roll back migration history');
        const missing = Object.keys(current.receipts).filter(
          (k) => !incoming.receipts[k] || incoming.receipts[k].hash !== current.receipts[k].hash
        );
        if (missing.length || incoming.revision < current.revision)
          throw Error('Older or divergent backup: current progress preserved');
        for (const [key, r] of Object.entries(current.records)) {
          const n = incoming.records[key];
          if (
            !n ||
            Object.entries(r.partners).some(
              ([id, p]) =>
                !n.partners[id] || n.partners[id].games < p.games || n.partners[id].wins < p.wins
            ) ||
            Object.entries(r.trumpWins).some(([c, v]) => n.trumpWins[c] < v) ||
            !dominates(n.stats, r.stats) ||
            Object.keys(r.achievements).some((id) => !n.achievements[id]) ||
            Object.keys(r.retiredAchievements).some((id) => !n.retiredAchievements[id])
          )
            throw Error('Backup would roll back career history');
        }
      } else if (!starter && before.rookLifetimeStats) {
        const a = parse(before.rookLifetimeStats),
          b = parse(x.data.rookLifetimeStats || '{}');
        for (const [name, r] of Object.entries(a))
          if (!b[name] || !dominates(numeric(b[name]), numeric(r)))
            throw Error('Older legacy backup: current progress preserved');
      }
      validateBackup({ ...x, data: after, version: 1 });
      const j = {
        version: 2,
        phase: 'prepared',
        before,
        after,
        beforeHash: digest(before),
        hash: digest(after),
        at: now(),
      };
      storage.setItem(JOURNAL, JSON.stringify(j));
      try {
        for (const k of Object.keys(before)) if (!(k in after)) storage.removeItem(k);
        for (const [k, v] of Object.entries(after)) storage.setItem(k, v);
        for (const k of Object.keys(before))
          if (!(k in after) && storage.getItem(k) !== null)
            throw Error('Restore removal verification failed');
        for (const [k, v] of Object.entries(after))
          if (storage.getItem(k) !== v) throw Error('Restore verification failed');
        j.phase = 'committed';
        storage.setItem(JOURNAL, JSON.stringify(j));
        storage.removeItem(JOURNAL);
      } catch (e) {
        try {
          recover();
        } catch (_) {}
        throw Error('Restore interrupted; recovery journal retained or rolled back: ' + e.message);
      }
      return { ok: true, restored: Object.keys(x.data).length, createdAt: x.createdAt };
    }
    function download(payload, name, type) {
      const blob = new Blob(
        [typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)],
        { type }
      );
      const a = document.createElement('a'),
        url = URL.createObjectURL(blob);
      a.href = url;
      a.download = name;
      a.setAttribute('data-hor-career-export', '1');
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
    function friendlyCode() {
      return storage.getItem('horFriendlyRecoveryCodeV1') || null;
    }
    function protectionStatus() {
      return {
        recoveryCode: friendlyCode(),
        lastBackupAt: storage.getItem('horLastCareerBackupV1'),
        localProgressionEnabled: mode() === 'local',
        recovery: 'Exported backup file required; no cloud lookup exists',
      };
    }
    function downloadBackup() {
      const b = buildBackup(),
        test = root.HORCareerPhoneTest?.active,
        payload = test ? root.HORCareerPhoneTest.wrapBackup(b) : b;
      download(
        payload,
        (test ? 'Griffin-Rook-Test-Backup-' : 'Griffin-Rook-Career-Backup-') +
          b.createdAt.replace(/[:.]/g, '-') +
          '.json',
        'application/json'
      );
      return payload;
    }
    function downloadRecoveryCode() {
      const s = protectionStatus();
      download(
        'GRIFFIN HOUSE OF ROOKS\n' +
          (s.recoveryCode || 'No local reference code assigned.') +
          '\nAn exported Career Backup file is required. A code cannot retrieve erased browser data. No cloud lookup exists.',
        'Griffin-Rook-Recovery-Information.txt',
        'text/plain'
      );
      return s;
    }
    function restoreBackupFile(file) {
      return file.text().then((t) => {
        const payload = JSON.parse(t);
        if (payload?.format === 'GriffinHouseOfRooksCareerTestBackup') {
          if (!root.HORCareerPhoneTest)
            throw Error('This test backup needs the game version with isolated test restore.');
          return root.HORCareerPhoneTest.start(payload);
        }
        return restoreBackupObject(payload);
      });
    }
    recover();
    P.core = {
      KEY,
      JOURNAL,
      digest,
      stable,
      read,
      migrate,
      activate,
      rename,
      recordHand,
      collect,
      validateBackup,
      recover,
      checkState,
      profile,
      mode,
    };
    P.offline = {
      humanActorId: actorId,
      localActorId: actorId,
      botActorId: botId,
      actorKey: (t, id) => t + ':' + id,
      ledgerRead,
      ledgerWrite() {
        throw Error('Use event-based Career v2 commits');
      },
      localLeaderboard(stat = 'points', type = null) {
        const s = read();
        return Object.values(s?.records || {})
          .filter((r) => !type || !!r.isBot === (type === 'bot'))
          .map((r) => ({ value: r.stats[stat] || 0, record: r }))
          .sort((a, b) => b.value - a.value);
      },
    };
    P.protection = {
      friendlyCode,
      protectionStatus,
      buildBackup,
      downloadBackup,
      downloadRecoveryCode,
      validateBackup,
      restoreBackupObject,
      restoreBackupFile,
      showRecoveryKit() {
        alert(protectionStatus().recovery);
      },
    };
    P.careerAdapters = {
      sync,
      profile,
      mode,
      activate,
      rename,
      relationshipRead(name) {
        const s = read(),
          p = s?.records.human.partners[botId(name)];
        return { partnerGames: p?.games || 0, partnerWins: p?.wins || 0 };
      },
    };
  }
  root.HORCareerCore = { install, digest, stable };
})(typeof window !== 'undefined' ? window : globalThis);
