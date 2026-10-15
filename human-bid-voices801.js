/* Owner-approved bid/pass speech for humans and deliberate bot bids. */
(function(){
  'use strict';
  const allowedAmounts = new Set(Array.from({length:20}, (_, i) => 100 + i * 5)); // 100–195; 200 is Shoot the Moon.
  const buffers = new Map();
  const seen = new Set();
  let activeSource = null;
  let activeGain = null;
  let loading = false;
  const queue = [];
  let serial = 0;
  let eventCounter = 0;
  let moonSpokenContext = null;
  function moonHandKey(){return {game:typeof game==='undefined'?null:game,hand:typeof handHistory==='undefined'?0:handHistory.length};}
  let moonContext = null;

  function soundAllowed(){
    try {
      if (typeof soundMuted !== 'undefined' && soundMuted) return false;
      if (!window.HORAudioMixer.voicesAllowed()) return false;
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
  function context(){return {game:typeof game==='undefined'?null:game,hand:typeof handHistory==='undefined'?0:handHistory.length};}
  function current(event){const now=context(),p=seatPlayer(Number(event.player));if(now.game?.shotTheMoon && event.action !== 'shootMoon')return false;return event.originGame===now.game&&event.originHand===now.hand&&p&&p.id===event.originActor&&genderFor(p)!==null&&(!now.game||!['play','score','waiting','lobby','deal','dealing'].includes(now.game.phase));}
  function pathFor(gender, clip){
    return 'assets/human-bid-voice801/' + gender + '/' + clip + '.mp3' + (clip.startsWith('moon-') ? '?v=805-ownerreview' : '');
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
    queue.length = 0;
    loading = false;
    if (activeSource) { try { activeSource.stop(); } catch (_) {} activeSource = null; }
    if (activeGain) { try { activeGain.disconnect(); } catch (_) {} activeGain = null; }
  }
  function startNext(){
    if (activeSource || loading || !queue.length) return;
    const event = queue.shift();
    const seat = Number(event.player);
    const p = seatPlayer(seat);
    const clip = event.action === 'shootMoon'
      ? (event.clip === 'moon-1' || event.clip === 'moon-2' ? event.clip : null)
      : clipFor(event.action, event.amount);
    const gender = event.voiceGender;
    if (!p || !clip || !gender || !current(event) || !soundAllowed()) { startNext(); return; }
    const token = serial;
    loading = true;
    load(gender, clip).then(buffer => {
      if (token !== serial) return;
      if (!buffer || !current(event) || !soundAllowed()) { loading = false; startNext(); return; }
      whenAudioReady(ctx => {
        if (token !== serial) return;
        loading = false;
        if (!current(event) || !soundAllowed()) { startNext(); return; }
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        const configured = 1;
        const volume = Math.max(0, Math.min(1, Number.isFinite(configured) ? configured : 1));
        source.buffer = buffer;
        gain.gain.value = 0.9 * volume;
        source.connect(gain);
        gain.connect(window.HORAudioMixer.output(ctx,'voices'));
        activeSource = source;
        activeGain = gain;
        source.onended = () => {
          if (activeSource === source) activeSource = null;
          if (activeGain === gain) activeGain = null;
          try { source.disconnect(); gain.disconnect(); } catch (_) {}
          if (token !== serial) return;
          startNext();
        };
        source.start();
      });
    });
  }
  function play(event){
    if (!event || !event.id || seen.has(event.id)) return;
    const seat = Number(event.player);
    if (!seatPlayer(seat)) return;
    const now = context();
    const moonAlreadyDeclared = moonContext && moonContext.game === now.game && moonContext.hand === now.hand;
    // A late auction packet must not refill the queue after the Moon flush.
    // Duplicate declarations with a new packet ID are also quiet for this hand.
    if (moonAlreadyDeclared || (now.game?.shotTheMoon && event.action !== 'shootMoon')) return;
    if (event.action === 'shootMoon') moonContext = now;
    if(event.action==='shootMoon'){const ctx=moonHandKey();if(moonSpokenContext&&moonSpokenContext.game===ctx.game&&moonSpokenContext.hand===ctx.hand)return;moonSpokenContext=ctx;stop();}
    seen.add(event.id);
    if (seen.size > 96) seen.delete(seen.values().next().value);
    // A confirmed Moon ends the auction. Old bids/Pass must not drain after
    // this new declaration, including pending decodes and a playing old bid.
    if (event.action === 'shootMoon') stop();
    const origin=context(),p=seatPlayer(seat);
    queue.push({...event,originGame:origin.game,originHand:origin.hand,originActor:p.id,voiceGender:genderFor(p)});
    startNext();
  }
  function makeId(){
    eventCounter++;
    try { return 'bidvoice801:' + crypto.randomUUID(); }
    catch (_) { return 'bidvoice801:' + Date.now() + ':' + eventCounter; }
  }
  function announce(seat, action, amount){
    if (!isHost) return;
    const p = seatPlayer(seat);
    if (!p) return;
    const id = makeId();
    const clip = action === 'shootMoon'
      ? ('moon-' + (((eventCounter - 1) % 2) + 1))
      : clipFor(action, amount);
    if (!clip) return;
    const event = {id, player:Number(seat), action, amount:Number(amount)||0, clip};
    play(event);
    try { broadcast({type:'bidVoice801', event}); } catch (_) {}
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
      load(gender, 'moon-1');
      load(gender, 'moon-2');
    }
  }
  document.addEventListener('pointerdown', () => { warmCurrentHuman(); preloadTable(); }, {once:true, passive:true});
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.HORBidVoice801 = Object.freeze({announce, receive, stop, genderFor, clipFor, preloadTable});
})();
