const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { parseArgs, assertTarget, selectTarget } = require('./cli');
const root = path.resolve(__dirname, '..');
function container(service, project = 'cerberus') {
  return {
    Id: 'example-id', Name: '/cerberus-' + service + '-1',
    State: { Running: true, Paused: false },
    Config: { Labels: {
      'com.docker.compose.project': project,
      'com.docker.compose.project.working_dir': root,
      'com.docker.compose.service': service,
      'com.docker.compose.oneoff': 'False',
    } },
  };
}
test('monitoring service aliases and container names are rejected', () => {
  for (const service of ['prometheus', 'grafana']) {
    assert.throws(() => parseArgs(['kill', service]), /protected/);
    const target = container(service);
    assert.throws(() => selectTarget([target], target.Name.slice(1), 'cerberus'), /Protected/);
  }
});
test('foreign projects, directories, unknown services, and one-off containers are rejected', () => {
  assert.throws(() => assertTarget(container('user-service', 'another'), 'cerberus'), /project/);
  const foreign = container('user-service');
  foreign.Config.Labels['com.docker.compose.project.working_dir'] = path.dirname(root);
  assert.throws(() => assertTarget(foreign, 'cerberus'), /directory/);
  assert.throws(() => assertTarget(container('database'), 'cerberus'), /Protected/);
  const oneoff = container('gateway');
  oneoff.Config.Labels['com.docker.compose.oneoff'] = 'True';
  assert.throws(() => assertTarget(oneoff, 'cerberus'), /Protected/);
});
test('ambiguous, stopped, and paused targets are rejected', () => {
  const target = container('user-service');
  assert.throws(() => selectTarget([target, target], 'user-service', 'cerberus'), /exactly one/);
  assert.throws(() => selectTarget([], '--all', 'cerberus'), /exactly one/);
  target.State.Running = false;
  assert.throws(() => selectTarget([target], 'user-service', 'cerberus'), /running/);
  target.State.Running = true;
  target.State.Paused = true;
  assert.throws(() => selectTarget([target], 'user-service', 'cerberus'), /unpaused/);
});
test('service alias and exact container name select an allowed target', () => {
  const target = container('user-service');
  assert.equal(selectTarget([target], 'user-service', 'cerberus'), target);
  assert.equal(selectTarget([target], 'cerberus-user-service-1', 'cerberus'), target);
});
test('delay and command validation rejects malformed input before Docker is called', () => {
  assert.equal(parseArgs(['kill', 'user-service']).seconds, 30);
  assert.equal(parseArgs(['kill', 'user-service', '--restart-after', '0.5']).seconds, 0.5);
  for (const value of ['-1', 'NaN', 'Infinity', '86401', '']) {
    assert.throws(() => parseArgs(['kill', 'user-service', '--restart-after', value]));
  }
  for (const args of [[], ['list', 'extra'], ['kill'], ['kill', 'user-service', '--wrong', '5']]) {
    assert.throws(() => parseArgs(args));
  }
});
