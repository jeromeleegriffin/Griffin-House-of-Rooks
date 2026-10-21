import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./adapter-live.js', import.meta.url), 'utf8');
const start = source.indexOf('  async function launchCloudEntry() {');
const end = source.indexOf('  launchCloudEntry().catch', start);
assert.ok(start > 0 && end > start);
const entry = source.slice(start, end) + '\nlaunchCloudEntry();';

async function run({ create = false, invite = '', name = 'Test Host', reservedSeat = true } = {}) {
  const calls = [];
  const codeField = { value: '' };
  const context = {
    window: { GHR_CLOUD_CREATE: create, GHR_CLOUD_INVITE: invite },
    playerNameField: { value: name },
    document: { getElementById: () => codeField },
    setLobbyJoining: () => calls.push('show-join'),
    status: (message) => calls.push('status:' + message),
    joinByCode: async () => calls.push('join:' + codeField.value),
    createCloudRoom: async () => calls.push('create'),
    reconnectCloudRoom: async () => { calls.push('reconnect'); return reservedSeat; },
  };
  await vm.runInNewContext(entry, context);
  return calls;
}

assert.deepEqual(await run({ create: true }), ['create'], 'explicit create must not silently resume an old room');
assert.deepEqual(await run({ invite: 'AB23CD45' }), ['join:AB23CD45'], 'explicit invite must not silently resume an unrelated room');
assert.deepEqual(await run(), ['reconnect'], 'an ordinary reload restores the reserved seat');
assert.match((await run({ create: true, name: '' }))[0], /^status:Enter your name/);
assert.equal((await run({ invite: 'AB23CD45', name: '' }))[0], 'show-join');
assert.deepEqual(await run({ reservedSeat: false }), ['reconnect', 'status:Online table ready. Create a room or join with a code.']);
console.log('PASS: explicit create/join wins over stale saved rooms, missing names remain recoverable, ordinary reload reconnects.');
