/* Original owner recording, mapped phrases and persistent alternate rotation. */
(() => {
  'use strict';
  const root = 'voices/jerome/events/';
  let rotation = {};
  try {
    rotation = JSON.parse(localStorage.getItem('horVoiceRotationV1') || '{}');
  } catch (_) {}
  const history = [];
  function choose(key, list) {
    const n = Number.isSafeInteger(rotation[key]) ? rotation[key] : 0;
    const value = list[n % list.length];
    rotation[key] = n + 1;
    try {
      localStorage.setItem('horVoiceRotationV1', JSON.stringify(rotation));
    } catch (_) {}
    history.push({ key, path: value });
    if (history.length > 100) history.shift();
    return value;
  }
  const paths = (names) => names.map((n) => root + n + '.mp3');
  const banks = {
    pass: paths(['pass-1', 'pass-2']),
    shootMoon: paths(['moon-1', 'moon-2', 'moon-3']),
    made: paths(['made-1', 'made-2']),
    gotSet: paths(['got-set-1', 'got-set-2']),
    setOpponent: paths(['set-opponent-1', 'set-opponent-2']),
    matchWin: paths(['good-game-1', 'good-game-2', 'win-1']),
    matchLose: paths(['good-game-1', 'good-game-2', 'lose-1', 'lose-2']),
  };
  function resolve(voice, action, amount) {
    if (voice === 'jerome') {
      if (action === 'bid') return root + Number(amount) + '.mp3';
      if (action === 'trump')
        return choose('jerome:trump:' + amount, [
          'voices/jerome/trumps_are_' + amount + '.ogg',
          root + 'trump-' + amount + '-2.mp3',
          root + 'trump-' + amount + '-3.mp3',
        ]);
      if (banks[action]) return choose('jerome:' + action, banks[action]);
    }
    if (action === 'shootMoon')
      return choose(
        voice + ':shootMoon',
        [1, 2].map(
          (n) => 'assets/human-bid-voice801/' + voice + '/moon-' + n + '.mp3?v=805-ownerreview'
        )
      );
    return null;
  }
  function isJerome(p) {
    return (
      String(
        (typeof playerAvatars !== 'undefined' && playerAvatars[p.id]) || p.avatar || ''
      ).toLowerCase() === 'jerome_founder'
    );
  }
  const results = new Set();
  function result(summary) {
    const event = summary?.careerEvent;
    if (!event?.matchId || !Number.isInteger(event.hand)) return;
    const id = event.matchId + ':' + event.hand;
    if (results.has(id)) return;
    results.add(id);
    if (results.size > 128) results.delete(results.values().next().value);
    const seat = players.findIndex((p) => p && isJerome(p));
    if (seat < 0 || players[seat].voice === 'silent') return;
    const team = players[seat].team;
    let action = null;
    if (event.completed && event.winnerTeam !== null)
      action = event.winnerTeam === team ? 'matchWin' : 'matchLose';
    else if (!summary.made) action = summary.bidderTeam === team ? 'gotSet' : 'setOpponent';
    else if (summary.bidderTeam === team) action = 'made';
    if (action) window.HORBidVoice801?.reaction(seat, action, 'jerome-result:' + id);
  }
  function assets() {
    return [
      ...new Set([
        ...Object.values(banks).flat(),
        ...Array.from({ length: 20 }, (_, i) => root + (100 + i * 5) + '.mp3'),
        ...['red', 'green', 'black', 'yellow'].flatMap((c) =>
          [2, 3].map((n) => root + 'trump-' + c + '-' + n + '.mp3')
        ),
      ]),
    ];
  }
  window.HORJeromeVoiceLines = {
    resolve,
    result,
    isJerome,
    choose,
    assets,
    inspect: () => ({ rotation: { ...rotation }, history: history.slice() }),
  };
})();
