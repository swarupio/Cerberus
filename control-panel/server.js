const http = require('node:http');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { assertTarget } = require('../chaos-tool/cli');

const root = path.resolve(__dirname, '..');
const run = promisify(execFile);
const services = ['gateway', 'user-service', 'order-service'];
const page = readFileSync(path.join(__dirname, 'index.html'));
let trafficTimer = null;
let trafficBusy = false;
let trafficController = null;
const trafficStats = { requestsSent: 0, successes: 0, errors: 0, lastLatencyMs: null };
const pendingActions = new Set();

async function docker(args) {
  const { stdout } = await run('docker', args, { cwd: root, timeout: 30000, windowsHide: true });
  return stdout.trim();
}

async function containers() {
  const config = JSON.parse(await docker(['compose', '--project-directory', root,
    '--file', path.join(root, 'docker-compose.yml'), 'config', '--format', 'json']));
  if (!config.name) throw new Error('Unable to determine Compose project name.');
  const ids = (await docker(['ps', '--all', '--quiet', '--no-trunc', '--filter',
    'label=com.docker.compose.project=' + config.name])).split(/\s+/).filter(Boolean);
  const inspected = ids.length ? JSON.parse(await docker(['inspect', '--type', 'container', ...ids])) : [];
  const allowed = inspected.filter(container => {
    try { assertTarget(container, config.name); return true; } catch { return false; }
  });
  return { project: config.name, allowed };
}

async function circuitState() {
  try {
    const response = await fetch('http://127.0.0.1:3000/metrics', { signal: AbortSignal.timeout(2000) });
    if (!response.ok) return 'unknown';
    for (const line of (await response.text()).split('\n')) {
      if (!/^gateway_circuit_breaker_state\{.*\}\s+1(?:\.0+)?\s*$/.test(line)) continue;
      if (!line.includes('downstream="user-service"')) continue;
      const state = line.match(/state="(closed|open|half_open)"/);
      if (state) return state[1];
    }
  } catch {}
  return 'unknown';
}

async function status() {
  const [{ allowed }, circuit] = await Promise.all([containers(), circuitState()]);
  return {
    services: services.map(service => {
      const matches = allowed.filter(container => container.Config.Labels['com.docker.compose.service'] === service);
      if (matches.length > 1) throw new Error('Multiple containers found for ' + service);
      return { service, status: matches[0]?.State.Running ? 'running' : 'stopped' };
    }),
    circuit: { downstream: 'user-service', state: circuit },
    traffic: Boolean(trafficTimer),
    trafficStats: { ...trafficStats },
  };
}

async function trafficTick() {
  if (trafficBusy || !trafficTimer) return;
  trafficBusy = true;
  const controller = new AbortController();
  trafficController = controller;
  try {
    await Promise.allSettled(['/users', '/orders'].map(async route => {
      const started = performance.now();
      trafficStats.requestsSent++;
      try {
        const response = await fetch('http://127.0.0.1:3000' + route, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(900)]),
        });
        await response.arrayBuffer();
        if (response.ok) trafficStats.successes++;
        else trafficStats.errors++;
      } catch {
        trafficStats.errors++;
      } finally {
        trafficStats.lastLatencyMs = Math.round((performance.now() - started) * 100) / 100;
      }
    }));
  } finally {
    trafficBusy = false;
    if (trafficController === controller) trafficController = null;
  }
}

function startTraffic() {
  if (trafficTimer) return;
  trafficTimer = setInterval(trafficTick, 1000);
  void trafficTick();
}

function stopTraffic() {
  clearInterval(trafficTimer);
  trafficTimer = null;
  trafficController?.abort();
}

function json(response, code, body) {
  response.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  // Local Docker controls must only be accessible through this loopback origin.
  if (request.headers.host !== '127.0.0.1:4000' && request.headers.host !== 'localhost:4000') {
    json(response, 403, { error: 'Localhost access only' }); return;
  }
  if (request.headers.origin && !['http://127.0.0.1:4000', 'http://localhost:4000'].includes(request.headers.origin)) {
    json(response, 403, { error: 'Cross-origin requests are blocked' }); return;
  }
  try {
    if (request.method === 'GET' && request.url === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(page); return;
    }
    if (request.method === 'GET' && request.url === '/api/status') {
      json(response, 200, await status()); return;
    }
    if (request.method === 'POST' && ['/api/traffic/start', '/api/traffic/stop'].includes(request.url)) {
      if (request.url.endsWith('/start')) {
        startTraffic();
      } else stopTraffic();
      json(response, 200, { traffic: Boolean(trafficTimer) }); return;
    }
    const action = request.url.match(/^\/api\/(kill|restart)\/([^/]+)$/);
    if (request.method === 'POST' && action) {
      const [, command, service] = action;
      const { project, allowed } = await containers();
      // Reuse the CLI policy even for absent or protected service names.
      assertTarget({ Config: { Labels: {
        'com.docker.compose.project': project,
        'com.docker.compose.project.working_dir': root,
        'com.docker.compose.service': service,
        'com.docker.compose.oneoff': 'false',
      } } }, project);
      const matches = allowed.filter(container => container.Config.Labels['com.docker.compose.service'] === service);
      if (matches.length !== 1) { json(response, 409, { error: 'Expected exactly one project container' }); return; }
      if (pendingActions.has(service)) { json(response, 409, { error: 'Service action already in progress' }); return; }
      pendingActions.add(service);
      try {
        const container = JSON.parse(await docker(['inspect', '--type', 'container', matches[0].Id]))[0];
        assertTarget(container, project);
        if (command === 'kill' && container.State.Running) {
          await docker(['kill', '--signal', 'SIGKILL', container.Id]);
        } else if (command === 'restart') await docker(['restart', container.Id]);
        const after = JSON.parse(await docker(['inspect', '--type', 'container', container.Id]))[0];
        if (after.State.Running !== (command === 'restart')) throw new Error('Container did not reach requested state');
        json(response, 200, { service, status: after.State.Running ? 'running' : 'stopped' });
      } finally { pendingActions.delete(service); }
      return;
    }
    json(response, 404, { error: 'Not found' });
  } catch (error) {
    console.error(error.message);
    json(response, error.message.startsWith('Protected target:') ? 403 : 500, { error: error.message });
  }
});

server.listen(4000, '127.0.0.1', () => {
  startTraffic();
  console.log('Control Panel listening at http://127.0.0.1:4000 (traffic on)');
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  stopTraffic();
  server.close();
  server.closeAllConnections();
});
