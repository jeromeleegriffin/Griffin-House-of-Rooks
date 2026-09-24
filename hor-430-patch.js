/* House of Rooks 430 patch — applied after the pinned full game.js blob */
/* Do not redeclare APP_VERSION (const in the pinned file). */

function whenAudioReady(fn) {
  if (typeof soundMuted !== 'undefined' && soundMuted) return;
  const ctx = (typeof ensureAudio === 'function') ? ensureAudio() : null;
  if (!ctx) return;
  const run = () => { try { fn(ctx); } catch (e) {} };
  if (ctx.state === 'suspended') {
    ctx.resume().then(() => run()).catch(() => {});
    return;
  }
  run();
}

const _horPlayNestRevealSequenceOrig = (typeof playNestRevealSequence === 'function')
  ? playNestRevealSequence
  : null;
function playNestRevealSequence() {
  if (typeof soundMuted !== 'undefined' && soundMuted) return;
  if (typeof soundCard !== 'undefined' && !soundCard) return;
  whenAudioReady(function (ctx) {
    if (_horPlayNestRevealSequenceOrig) {
      try { _horPlayNestRevealSequenceOrig(); } catch (e) {}
    }
  });
}

function pulseTurnFlash() {
  try {
    const me = (typeof $ === 'function') ? $('slot-me') : document.getElementById('slot-me');
    if (me) me.classList.add('is-turn');
    const theater = (typeof $ === 'function') ? $('landscapeTheater') : document.getElementById('landscapeTheater');
    if (theater) theater.classList.remove('lt-your-turn');
  } catch (e) {}
}

turnFlashUntil = 0;

const _horNotifyYourTurnOrig = (typeof notifyYourTurn === 'function') ? notifyYourTurn : null;
function notifyYourTurn() {
  turnFlashUntil = 0;
  if (_horNotifyYourTurnOrig) {
    try { _horNotifyYourTurnOrig(); } catch (e) {}
    try {
      document.querySelectorAll('.turn-name-flash, .turn-flash-seat, .turn-msg-flash, .lt-turn-flash, .lt-turn-flash-label').forEach((el) => {
        el.classList.remove('turn-name-flash', 'turn-flash-seat', 'turn-msg-flash', 'lt-turn-flash', 'lt-turn-flash-label');
      });
      const theater = document.getElementById('landscapeTheater');
      if (theater) theater.classList.remove('lt-your-turn');
    } catch (e) {}
  }
}

const _horScheduleOrig = (typeof scheduleTopNestFlip === 'function') ? scheduleTopNestFlip : null;
function scheduleTopNestFlip() {
  try { if (typeof ensureAudio === 'function') ensureAudio(); } catch (e) {}
  if (_horScheduleOrig) return _horScheduleOrig();
}
