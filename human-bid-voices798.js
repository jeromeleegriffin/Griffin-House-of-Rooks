/* Owner-approved bid/pass speech for humans and deliberate bot bids. */
(function(){
  'use strict';
  const allowedAmounts = new Set(Array.from({length:20}, (_, i) => 100 + i * 5)); // 100–195; 200 is Shoot the Moon.
  const buffers = new Map();
  const seen = new Set();
  let activeSource = null;
  let activeGain = null;
  let serial = 0;
  let eventCounter = 0;

  function soundAllowed(){
    try {
      if (typeof soundMuted !== 'undefined' && soundMuted) return false;
      if (typeof soundCard !== 'undefined' && !soundCard) return false;
      if (document.hidden || !document.body.classList.contains('in-game')) return false;
      return true;
    } catch (_) { return false; }
  }
  function seatPlayer(seat){
    const p = Array.isArray(players) ? players[seat] : null;
    return p || null;
  }
  function genderFor(p){
    const preference = p.voice || 'avatar';
    if (preference === 'silent') return null;
    if (preference === 'male' || preference === 'female') return preference;
    const avatar = String((playerAvatars && playerAvatars[p.id]) || p.avatar || '').toLowerCase();
    const voiceId = window.HORTrumpVoice?.voiceFor(avatar) || '';
    if (voiceId === 'jerome') return 'male';
    const presentation = window.HORTrumpCast790?.[voiceId]?.presentation;
    if (presentation === 'male' || presentation === 'female') return presentation;
    const humanVoice = window.HORHumanAvatars?.[avatar]?.voice;
    if (humanVoice === 'male' || humanVoice === 'female') return humanVoice;
    return voiceId === 'male' || voiceId === 'female' ? voiceId : null;
  }
  function clipFor(action, amount){
    if (action === 'pass') return 'pass';
    const n = Number(amount);
    return Number.isInteger(n) && allowedAmounts.has(n) ? String(n) : null;
  }
  function pathFor(gender, clip){
    return 'assets/human-bid-voice798/' + gender + '/' + clip + '.mp3';
  }
  function load(gender, clip){
    const key = pathFor(gender, clip);
    if (buffers.has(key)) return buffers.get(key);
    const pending = fetch(key, {cache:'force-cache'})
      .then(r => { if (!r.ok) throw new Error('voice clip unavailable'); return r.arrayBuffer(); })
      .then(bytes => {
        const ctx = ensureAudio();
        if (!ctx) throw new Error('audio context unavailable');
        return ctx.decodeAudioData(bytes.slice(0));
      })
      .catch(() => { buffers.delete(key); return null; });
    buffers.set(key, pending);
    return pending;
  }
  function stop(){
    serial++;
    if (activeSource) { try { activeSource.stop(); } catch (_) {} activeSource = null; }
    if (activeGain) { try { activeGain.disconnect(); } catch (_) {} activeGain = null; }
  }
  function play(event){
    if (!event || !event.id || seen.has(event.id)) return;
    const seat = Number(event.player);
    const p = seatPlayer(seat);
    const clip = clipFor(event.action, event.amount);
    if (!p || !clip) return;
    const gender = genderFor(p);
    if (!gender || !soundAllowed()) return;
    seen.add(event.id);
    if (seen.size > 96) seen.delete(seen.values().next().value);
    const token = ++serial;
    if (activeSource) { try { activeSource.stop(); } catch (_) {} activeSource = null; }
    load(gender, clip).then(buffer => {
      if (!buffer || token !== serial || !soundAllowed()) return;
      whenAudioReady(ctx => {
        if (token !== serial || !soundAllowed()) return;
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        const configured = Number(window.he064Volumes?.gameplay);
        const volume = Math.max(0, Math.min(1, Number.isFinite(configured) ? configured : 1));
        source.buffer = buffer;
        gain.gain.value = 0.9 * volume;
        source.connect(gain);
        gain.connect(ctx.destination);
        activeSource = source;
        activeGain = gain;
        source.onended = () => {
          if (activeSource === source) activeSource = null;
          if (activeGain === gain) activeGain = null;
          try { source.disconnect(); gain.disconnect(); } catch (_) {}
        };
        source.start();
      });
    });
  }
  function makeId(){
    eventCounter++;
    try { return 'bidvoice798:' + crypto.randomUUID(); }
    catch (_) { return 'bidvoice798:' + Date.now() + ':' + eventCounter; }
  }
  function announce(seat, action, amount){
    if (!isHost) return;
    const p = seatPlayer(seat);
    if (!p || !clipFor(action, amount)) return;
    const event = {id:makeId(), player:Number(seat), action, amount:Number(amount)||0};
    play(event);
    try { broadcast({type:'bidVoice798', event}); } catch (_) {}
  }
  function receive(data){
    if (!data || !data.event) return;
    play(data.event);
  }
  function warmCurrentHuman(){
    try {
      const p = seatPlayer(myIndex);
      if (!p) return;
      const gender = genderFor(p);
      if (gender) { load(gender, 'pass'); load(gender, '100'); }
    } catch (_) {}
  }
  function preloadTable(){
    // Preload both presentation voices before bidding so a bot's first bid
    // never has to wait for a network fetch before it can speak.
    for (const gender of ['male', 'female']) {
      load(gender, 'pass');
      for (const amount of allowedAmounts) load(gender, String(amount));
    }
  }
  document.addEventListener('pointerdown', () => { warmCurrentHuman(); preloadTable(); }, {once:true, passive:true});
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.HORBidVoice798 = Object.freeze({announce, receive, stop, genderFor, clipFor, preloadTable});
})();
