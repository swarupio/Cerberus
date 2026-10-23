const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createExperiment, summarize, table, cooldownAverages, cooldownTable } = require('./experiment');
const { isLocalAdmin, parseBreakerSettings } = require('../gateway/admin');

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

test('runtime settings preserve omitted fields and reject invalid cooldowns atomically', () => {
  const current = { breaker: 'on', resetTimeoutSeconds: 30 };
  assert.deepEqual(parseBreakerSettings('off', current), { breaker: 'off', resetTimeoutSeconds: 30 });
  assert.deepEqual(parseBreakerSettings('{"resetTimeoutSeconds":5}', current), { breaker: 'on', resetTimeoutSeconds: 5 });
  assert.deepEqual(parseBreakerSettings('{"breaker":"off","resetTimeoutSeconds":1.5}', current),
    { breaker: 'off', resetTimeoutSeconds: 1.5 });
  for (const body of ['{}', '[]', 'null', 'true', 'invalid', '{"resetTimeoutSeconds":0}',
    '{"resetTimeoutSeconds":301}', '{"resetTimeoutSeconds":"5"}', '{"resetTimeoutSeconds":null}',
    '{"breaker":"bad","resetTimeoutSeconds":5}', '{"unexpected":1}']) {
    assert.throws(() => parseBreakerSettings(body, current), body);
  }
  assert.deepEqual(current, { breaker: 'on', resetTimeoutSeconds: 30 });
});

test('cooldown comparison averages run p95s and does not omit missing recoveries', () => {
  const results = [10, 20, 90].map((p95Ms, index) => ({ mode: 'on', resetTimeoutSeconds: 30,
    summary: { successPercent: 70 + index * 10, p95Ms, recoverySeconds: index + 1 } }));
  results.push({ mode: 'on', resetTimeoutSeconds: 5,
    summary: { successPercent: 80, p95Ms: 10, recoverySeconds: null } });
  results.push({ mode: 'off', resetTimeoutSeconds: 30,
    summary: { successPercent: 0, p95Ms: 1000, recoverySeconds: 50 } });
  const averages = cooldownAverages(results);
  assert.deepEqual(averages[0], { resetTimeoutSeconds: 30, runs: 3, recoveredRuns: 3,
    successPercent: 80, p95Ms: 40, recoverySeconds: 2 });
  assert.equal(averages[1].recoverySeconds, null);
  assert.equal(averages[1].recoveredRuns, 0);
  assert.match(cooldownTable(results), /30 s \| 3 \| 80.00 \| 40.00 \| 2.00/);
  assert.match(cooldownTable(results), /Not observed in every run/);
});

test('interrupted comparison restores the previous runtime cooldown and mode', async () => {
  let ready;
  const calls = [];
  const experiment = createExperiment({
    action: async () => {},
    toggle: (...args) => {
      calls.push(args);
      return calls.length === 1 ? new Promise(resolve => { ready = resolve; }) : Promise.resolve();
    },
    stopTraffic() {}, startTraffic() {}, trafficOn: () => false, root: __dirname,
  });
  experiment.start({ kind: 'cooldowns' });
  assert.equal(experiment.snapshot().totalRounds, 6);
  const stopped = experiment.stop();
  ready({ previous: 'off', previousResetTimeoutSeconds: 17 });
  await stopped;
  assert.deepEqual(calls, [['off'], ['off', 17]]);
  assert.equal(experiment.snapshot().status, 'failed');
});

test('invalid experiment cooldowns are rejected before traffic or chaos actions', () => {
  const experiment = createExperiment({});
  for (const resetTimeoutSeconds of [0, 301, '5', null, NaN]) {
    assert.throws(() => experiment.start({ resetTimeoutSeconds }), /Cooldown/);
    assert.equal(experiment.snapshot().status, 'idle');
  }
});
