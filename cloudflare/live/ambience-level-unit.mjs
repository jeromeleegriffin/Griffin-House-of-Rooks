import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source = fs.readFileSync(process.argv[2] || 'cabin-ambience041.js', 'utf8');
const pcmSource = fs.readFileSync(
  process.env.GHR_CABIN_PCM || 'assets/audio/cabin041/pcm-data.js',
  'utf8'
);
const prefs = new Map([
  ['rookCabinVolume041', '6'],
  ['rookFireVolume758', '10'],
]);
const before = JSON.stringify([...prefs]);
const events = new Map(),
  timers = new Map(),
  contexts = [];
let timerId = 0;
const param = (value) => ({
  value,
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
});
const node = (type) => ({
  type,
  outputs: [],
  disconnected: false,
  connect(to) {
    this.outputs.push(to);
  },
  disconnect() {
    this.outputs = [];
    this.disconnected = true;
  },
});
class Context {
  state = 'suspended';
  currentTime = 0;
  sources = [];
  nodes = [];
  constructor() {
    contexts.push(this);
  }
  async resume() {
    this.state = 'running';
  }
  async suspend() {
    this.state = 'suspended';
  }
  createGain() {
    const n = Object.assign(node('gain'), { gain: param(1) });
    this.nodes.push(n);
    return n;
  }
  createWaveShaper() {
    const n = Object.assign(node('ceiling'), { curve: null });
    this.nodes.push(n);
    return n;
  }
  createBuffer(c, length, rate) {
    const data = new Float32Array(length);
    return { duration: length / rate, data, getChannelData: () => data };
  }
  createBufferSource() {
    const n = Object.assign(node('source'), { start() {}, stop() {} });
    this.sources.push(n);
    return n;
  }
}
const add = (type, fn) => {
  const list = events.get(type) || [];
  list.push(fn);
  events.set(type, list);
};
const controls = new Map();
for (const id of ['opt-cabin-volume', 'opt-fire-volume', 'opt-cabin-ambience'])
  controls.set(id, { value: '', checked: true });
const sink = node('atmosphere');
const window = {
  AudioContext: Context,
  HORAudioMixer: {
    output: (ctx, category) => {
      assert.equal(category, 'atmosphere');
      return sink;
    },
  },
  addEventListener: add,
};
const document = {
  hidden: false,
  readyState: 'complete',
  body: { classList: { contains: () => true } },
  getElementById: (id) => controls.get(id) || null,
  addEventListener: add,
};
const env = vm.createContext({
  window,
  document,
  soundMuted: false,
  console,
  localStorage: { getItem: (k) => prefs.get(k) ?? null, setItem: (k, v) => prefs.set(k, v) },
  MutationObserver: class {
    observe() {}
  },
  atob: (v) => Buffer.from(v, 'base64').toString('binary'),
  setTimeout: (fn, ms) => {
    const id = ++timerId;
    timers.set(id, { fn, ms });
    return id;
  },
  clearTimeout: (id) => timers.delete(id),
});
vm.runInContext(pcmSource, env);
vm.runInContext(source, env);
async function settle() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
async function event(type) {
  for (const fn of events.get(type) || []) fn();
  await settle();
}
function shape(curve, x) {
  const position = (Math.max(-1, Math.min(1, x)) + 1) * 0.5 * (curve.length - 1);
  const i = Math.floor(position),
    j = Math.min(i + 1, curve.length - 1);
  return curve[i] + (curve[j] - curve[i]) * (position - i);
}
function path(source) {
  const out = [];
  let p = source;
  while (p) {
    out.push(p);
    assert(out.length < 20);
    p = p.outputs[0];
  }
  return out;
}
function render(source) {
  const route = path(source);
  assert.equal(route.at(-1), sink, 'Source bypassed saved ambience mixer');
  let values = source.buffer.data.slice();
  for (const n of route.slice(1)) {
    if (n.type === 'gain') values = values.map((x) => x * n.gain.value);
    if (n.type === 'ceiling') values = values.map((x) => shape(n.curve, x));
  }
  return values;
}
const rmsDb = (values) =>
  20 * Math.log10(Math.sqrt(values.reduce((s, x) => s + x * x, 0) / values.length));
await event('pointerdown');
let context = contexts.at(-1);
assert.equal(context.sources.length, 2);
const [fire, wind] = context.sources;
const fireDb = rmsDb(render(fire)),
  windDb = rmsDb(render(wind));
assert(windDb > -50 && windDb < -38, `Wind still inaudible or excessive: ${windDb}dBFS`);
assert(fireDb > -60 && fireDb < -48, `Faint fire level outside calibrated range: ${fireDb}dBFS`);
assert.equal(window.CabinAmbience041.inspect().recordingGain, 100);
assert.equal(JSON.stringify([...prefs]), before, 'Correction reset saved preferences');
const route = path(wind),
  preamp = route.find((n) => n.type === 'gain' && n.gain.value === 100),
  ceiling = route.find((n) => n.type === 'ceiling');
assert(preamp && ceiling && route.indexOf(ceiling) > route.indexOf(preamp));
assert([...ceiling.curve].every((x) => Number.isFinite(x) && Math.abs(x) < 0.45));
for (const amplitude of [-100, -10, -1, -0.1, 0, 0.1, 1, 10, 100])
  assert(Math.abs(shape(ceiling.curve, amplitude)) < 0.45, 'High-volume signal lacks headroom');
const nodeCount = context.nodes.length;
for (let i = 0; i < 10; i++) await event('pointerdown');
assert.equal(context.nodes.length, nodeCount, 'Repeated sync stacks output gain/loops');
assert.equal(window.CabinAmbience041.inspect().voices.length, 2);
// Existing controls must still reach silence and retain their saved values.
controls.get('opt-fire-volume').value = '0';
controls.get('opt-fire-volume').oninput();
await settle();
assert(render(fire).every((x) => x === 0));
controls.get('opt-fire-volume').value = '10';
controls.get('opt-fire-volume').oninput();
await settle();
assert.equal(window.CabinAmbience041.inspect().fireVolume, 10);
controls.get('opt-cabin-volume').value = '100';
controls.get('opt-cabin-volume').oninput();
await settle();
for (const s of context.sources) assert([...render(s)].every((x) => Math.abs(x) < 0.45));
controls.get('opt-cabin-volume').value = '0';
controls.get('opt-cabin-volume').oninput();
await settle();
assert.equal(window.CabinAmbience041.inspect().running, false);
controls.get('opt-cabin-volume').value = '6';
controls.get('opt-cabin-volume').oninput();
await settle();
const newChain = context.nodes.filter((n) => n.type === 'ceiling').at(-1);
assert.notEqual(newChain, ceiling);
for (const [id, t] of [...timers])
  if (t.ms === 160) {
    timers.delete(id);
    t.fn();
  }
assert(ceiling.disconnected && preamp.disconnected, 'Stopped output nodes leaked');
assert(!newChain.disconnected, 'Stale stop disconnected replacement chain');
env.soundMuted = true;
await window.CabinAmbience041.sync();
assert.equal(window.CabinAmbience041.inspect().running, false);
assert.equal(prefs.get('rookCabinVolume041'), '6');
assert.equal(prefs.get('rookFireVolume758'), '10');
console.log(
  JSON.stringify({
    pass: true,
    steadyStateEstimatedRmsDb: { fire: +fireDb.toFixed(1), wind: +windDb.toFixed(1) },
    preferencesPreserved: true,
    sharedCeilingBound: 0.45,
    duplicates: false,
    staleStopSafe: true,
    scope:
      'Real preserved PCM through actual graph, simulated AudioContext and curve evaluation; not device audible acceptance',
  })
);
