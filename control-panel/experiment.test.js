const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createExperiment, summarize, table } = require('./experiment');
const { isLocalAdmin } = require('../gateway/admin');

test('summary includes failures and uses nearest-rank percentiles', () => {
  const result = summarize([{ ok: true, ms: 10 }, { ok: false, ms: 100 },
    { ok: true, ms: 20 }, { ok: false, ms: 200 }], null);
  assert.equal(result.successPercent, 50);
  assert.equal(result.errorPercent, 50);
  assert.equal(result.p50Ms, 20);
  assert.equal(result.p95Ms, 200);
  assert.match(table([{ mode: 'on', summary: result }]), /Not observed/);
});

test('admin rejects a container peer even with forged localhost headers', () => {
  const request = { socket: { remoteAddress: '172.22.0.99' }, headers: { host: 'localhost:3000' } };
  assert.equal(isLocalAdmin(request), false);
  request.socket.remoteAddress = '127.0.0.1';
  assert.equal(isLocalAdmin(request), true);
  request.headers.origin = 'https://example.com';
  assert.equal(isLocalAdmin(request), false);
  delete request.headers.origin;
  request.headers.host = 'gateway:3000';
  assert.equal(isLocalAdmin(request), false);
});

test('failed experiments restore user-service, breaker, and background traffic', async () => {
  const actions = [];
  const modes = [];
  let resumed = false;
  const experiment = createExperiment({
    action: async (...args) => { actions.push(args); },
    toggle: async mode => { modes.push(mode); if (modes.length === 1) throw new Error('Gateway unreachable'); },
    stopTraffic() {}, startTraffic() { resumed = true; }, trafficOn: () => true,
    root: __dirname,
  });
  experiment.start();
  assert.throws(() => experiment.start(), /already running/);
  await experiment.stop();
  assert.equal(experiment.snapshot().status, 'failed');
  assert.match(experiment.snapshot().phase, /Gateway unreachable/);
  assert.deepEqual(actions, [['restart', 'user-service']]);
  assert.deepEqual(modes, ['off', 'on']);
  assert.equal(resumed, true);
});

test('shutdown during initial setup prevents either chaos round', async () => {
  let ready;
  const modes = [];
  const actions = [];
  const experiment = createExperiment({
    action: async (...args) => { actions.push(args); },
    toggle: mode => {
      modes.push(mode);
      return modes.length === 1 ? new Promise(resolve => { ready = resolve; }) : Promise.resolve();
    },
    stopTraffic() {}, startTraffic() {}, trafficOn: () => false, root: __dirname,
  });
  experiment.start();
  const stopped = experiment.stop();
  ready({ previous: 'off' });
  await stopped;
  assert.deepEqual(modes, ['off', 'off']);
  assert.deepEqual(actions, [['restart', 'user-service']]);
  assert.equal(experiment.snapshot().status, 'failed');
  assert.match(experiment.snapshot().phase, /interrupted/);
});
