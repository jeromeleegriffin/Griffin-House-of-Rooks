import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root = process.argv[2] || path.dirname(new URL(import.meta.url).pathname);
const all = [];
class FakeAudioContext {
  state = 'suspended';
  currentTime = 0;
  resumeCalls = 0;
  failResume = false;
  destination = {};
  constructor() {
    all.push(this);
  }
  async resume() {
    this.resumeCalls++;
    if (this.state === 'closed' || this.failResume) throw Error('unavailable');
    this.state = 'running';
  }
  async suspend() {
    this.state = 'suspended';
  }
  createGain() {
    const gain = {
      value: 1,
      setValueAtTime(v) {
        this.value = v;
      },
      setTargetAtTime(v) {
        this.value = v;
      },
      linearRampToValueAtTime(v) {
        this.value = v;
      },
      cancelScheduledValues() {},
    };
    return { gain, connect() {}, disconnect() {} };
  }
  createWaveShaper() {
    return { curve: null, connect() {}, disconnect() {} };
  }
  createBuffer(_, size) {
    return { duration: 1, getChannelData: () => new Float32Array(size) };
  }
  createBufferSource() {
    return { connect() {}, disconnect() {}, start() {}, stop() {} };
  }
}
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

if (!process.argv.includes('--cabin-only')) {
  const game = fs.readFileSync(path.join(root, 'game060.js'), 'utf8');
  const begin = game.indexOf('let audioCtx = null;');
  const end = game.indexOf('function applyA11y()', begin);
  assert(begin >= 0 && end > begin);
  const main = vm.createContext({
    window: { AudioContext: FakeAudioContext },
    soundMuted: false,
    console,
  });
  vm.runInContext(game.slice(begin, end), main);
  let played = 0;
  main.onReady = (ctx) => {
    assert.equal(ctx.state, 'running', 'Effects/voice callback ran before actual audio recovery');
    played++;
  };
  vm.runInContext('whenAudioReady(onReady)', main);
  await settle();
  const first = all.at(-1);
  for (const state of ['suspended', 'interrupted']) {
    first.state = state;
    vm.runInContext('whenAudioReady(onReady)', main);
    await settle();
    assert.equal(first.state, 'running', `Main audio failed to recover ${state}`);
  }
  first.state = 'closed';
  vm.runInContext('whenAudioReady(onReady)', main);
  await settle();
  assert.notEqual(all.at(-1), first, 'Closed main context was reused');
  const recovered = all.at(-1);
  main.soundMuted = true;
  const before = played;
  vm.runInContext('whenAudioReady(onReady)', main);
  await settle();
  assert.equal(played, before, 'Recovery overrode intentional mute');
  assert.equal(recovered.state, 'running');
}

const events = new Map();
const timeouts = new Map();
let timerId = 0;
const prefs = new Map([
  ['rookCabinVolume041', '6'],
  ['rookFireVolume758', '10'],
]);
const baselinePrefs = JSON.stringify([...prefs]);
const add = (type, fn) => {
  const list = events.get(type) || [];
  list.push(fn);
  events.set(type, list);
};
const document = {
  hidden: false,
  readyState: 'complete',
  body: { classList: { contains: (c) => c === 'in-game' } },
  getElementById: () => null,
  addEventListener: add,
};
const window = {
  AudioContext: FakeAudioContext,
  HORCabinSamples: { fire: 'AAAAAA==', wind: 'AAAAAA==' },
  HORAudioMixer: { output: () => ({}) },
  addEventListener: add,
};
const cabin = vm.createContext({
  window,
  document,
  soundMuted: false,
  console,
  localStorage: { getItem: (k) => prefs.get(k) ?? null, setItem: (k, v) => prefs.set(k, v) },
  MutationObserver: class {
    observe() {}
  },
  atob: (x) => Buffer.from(x, 'base64').toString('binary'),
  setTimeout: (fn, ms) => {
    const id = ++timerId;
    timeouts.set(id, { fn, ms });
    return id;
  },
  clearTimeout: (id) => timeouts.delete(id),
});
vm.runInContext(fs.readFileSync(path.join(root, 'cabin-ambience041.js'), 'utf8'), cabin);
const fireEvent = async (type) => {
  for (const fn of events.get(type) || []) fn();
  await settle();
};
await fireEvent('pointerdown');
let context = all.at(-1);
assert.equal(window.CabinAmbience041.inspect().voices.length, 2);
for (const state of ['suspended', 'interrupted']) {
  context.state = state;
  const calls = context.resumeCalls;
  await fireEvent('pointerdown');
  assert.equal(context.state, 'running', `Ambience remained silent after ${state}`);
  assert(context.resumeCalls > calls, 'Ambience trusted a stale running flag');
  assert.equal(
    window.CabinAmbience041.inspect().voices.length,
    2,
    'Recovery duplicated ambient loops'
  );
}
context.state = 'interrupted';
context.failResume = true;
await fireEvent('pointerdown');
assert.equal(context.state, 'interrupted');
context.failResume = false;
await fireEvent('pointerdown');
assert.equal(context.state, 'running', 'Later gesture could not retry rejected recovery');
document.hidden = true;
await fireEvent('visibilitychange');
assert.equal(window.CabinAmbience041.inspect().running, false);
document.hidden = false;
await fireEvent('visibilitychange');
for (const [id, timer] of [...timeouts])
  if (timer.ms === 160) {
    timeouts.delete(id);
    timer.fn();
  }
assert.equal(context.state, 'running', 'Old stop timer suspended restarted ambience');
context.state = 'closed';
await fireEvent('pointerdown');
assert.notEqual(all.at(-1), context, 'Closed ambience context was reused');
assert.equal(window.CabinAmbience041.inspect().voices.length, 2);
cabin.soundMuted = true;
await window.CabinAmbience041.sync();
assert.equal(window.CabinAmbience041.inspect().running, false, 'Ambience ignored intentional mute');
cabin.soundMuted = false;
await fireEvent('pointerdown');
assert.equal(window.CabinAmbience041.inspect().running, true);
assert.equal(
  JSON.stringify([...prefs]),
  baselinePrefs,
  'Recovery changed saved volume preferences'
);
console.log(
  'PASS: main and ambience suspension/interruption/closed-context recovery; rejected resume retry; background return; no duplicate loops; mute and volumes preserved.'
);
