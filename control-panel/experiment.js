const { mkdir, appendFile } = require('node:fs/promises');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

function summarize(samples, recoverySeconds) {
  const latencies = samples.map(sample => sample.ms).sort((a, b) => a - b);
  const successes = samples.filter(sample => sample.ok).length;
  const percentile = p => latencies.length ? latencies[Math.ceil(latencies.length * p) - 1] : null;
  return {
    requests: samples.length, successes, errors: samples.length - successes,
    successPercent: samples.length ? successes / samples.length * 100 : 0,
    errorPercent: samples.length ? (samples.length - successes) / samples.length * 100 : 0,
    p50Ms: percentile(.5), p95Ms: percentile(.95), recoverySeconds,
  };
}

function table(results) {
  const value = (mode, key, suffix = '') => {
    const n = results.find(result => result.mode === mode)?.summary[key];
    return n == null ? 'Not observed' : Number(n).toFixed(2) + suffix;
  };
  return [
    '| Metric | Breaker ON | Breaker OFF |', '| --- | ---: | ---: |',
    ...[['Requests', 'requests', ''], ['Success', 'successPercent', '%'], ['Errors', 'errorPercent', '%'],
      ['p50 latency', 'p50Ms', ' ms'], ['p95 latency', 'p95Ms', ' ms'],
      ['/users recovery after restart request', 'recoverySeconds', ' s']]
      .map(([label, key, suffix]) => `| ${label} | ${value('on', key, suffix)} | ${value('off', key, suffix)} |`),
  ].join('\n');
}

function createExperiment({ action, toggle, stopTraffic, startTraffic, trafficOn, root }) {
  let state = { status: 'idle', results: [] };
  let task;
  let controller;
  let stopping = false;
  const snapshot = () => ({ ...state, elapsedSeconds: state.roundStarted
    ? Math.min(60, (performance.now() - state.roundStarted) / 1000) : 0 });

  async function runRound(mode, signal) {
    state.phase = 'Preparing ' + mode.toUpperCase();
    await action('restart', 'user-service');
    await toggle('off');
    for (const route of ['/users', '/orders']) {
      let ready = false;
      for (let retry = 0; retry < 50; retry++) {
        signal.throwIfAborted();
        try {
          const response = await fetch('http://127.0.0.1:3000' + route, { signal: AbortSignal.timeout(1000) });
          await response.arrayBuffer();
          if (response.ok) { ready = true; break; }
        } catch {}
        await delay(100, undefined, { signal });
      }
      if (!ready) throw new Error('Preflight failed: ' + route);
    }
    await toggle(mode);
    const samples = [];
    const pending = new Set();
    const started = performance.now();
    let restartRequested = null;
    let recovered = null;
    state.roundStarted = started;
    state.phase = 'Running ' + mode.toUpperCase();
    state.requestsSent = 0;
    state.completed = 0;
    const events = [];
    const scheduledAction = async (seconds, command) => {
      await delay(Math.max(0, started + seconds * 1000 - performance.now()), undefined, { signal });
      if (command === 'restart') restartRequested = performance.now();
      const requestedSeconds = (performance.now() - started) / 1000;
      await action(command, 'user-service');
      events.push({ command, requestedSeconds, completedSeconds: (performance.now() - started) / 1000 });
    };
    // Collect action errors immediately; the scheduler checks them before dispatching more traffic.
    let actionError;
    const actions = [scheduledAction(15, 'kill'), scheduledAction(40, 'restart')]
      .map(promise => promise.catch(error => { actionError = error; }));
    try {
      // 20 total requests/s, evenly split; each request is dispatched independently.
      for (let index = 0; index < 1200; index++) {
        await delay(Math.max(0, started + index * 50 - performance.now()), undefined, { signal });
        signal.throwIfAborted();
        if (actionError) throw actionError;
        if (performance.now() - started >= 60000) throw new Error('Load scheduler fell behind the 60-second window');
        const route = index % 2 === 0 ? '/users' : '/orders';
        state.requestsSent++;
        const request = (async () => {
          const sent = performance.now();
          let ok = false;
          try {
            const response = await fetch('http://127.0.0.1:3000' + route, {
              signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
            });
            await response.arrayBuffer();
            ok = response.ok;
          } catch {}
          const completed = performance.now();
          samples.push({ route, ok, ms: completed - sent });
          state.completed++;
          if (route === '/users' && ok && restartRequested !== null && sent >= restartRequested && recovered === null) {
            recovered = (completed - restartRequested) / 1000;
          }
        })();
        pending.add(request);
        void request.finally(() => pending.delete(request));
      }
      await delay(Math.max(0, started + 60000 - performance.now()), undefined, { signal });
      await Promise.all(actions);
      if (actionError) throw actionError;
      await Promise.all(pending);
      return { mode, summary: summarize(samples, recovered), events,
        routes: Object.fromEntries(['/users', '/orders'].map(route => [route,
          summarize(samples.filter(sample => sample.route === route), route === '/users' ? recovered : null)])) };
    } finally {
      controller.abort();
      await Promise.all(actions);
      await Promise.all(pending);
      state.roundStarted = null;
    }
  }

  async function run() {
    const resumeTraffic = trafficOn();
    let previous = 'on';
    let failure;
    stopTraffic();
    try {
      previous = (await toggle('off')).previous;
      for (const mode of ['on', 'off']) {
        if (stopping) throw new Error('Experiment interrupted');
        controller = new AbortController();
        state.results.push(await runRound(mode, controller.signal));
      }
    } catch (error) { failure = error; }
    state.phase = 'Restoring services';
    for (const restore of [() => action('restart', 'user-service'), () => toggle(previous)]) {
      try { await restore(); } catch (error) { failure = new Error([failure?.message, 'Cleanup: ' + error.message].filter(Boolean).join('; ')); }
    }
    if (resumeTraffic) startTraffic();
    if (!failure) {
      try {
        const directory = path.join(root, 'experiments');
        await mkdir(directory, { recursive: true });
        await appendFile(path.join(directory, 'results.md'),
          `\n## ${state.startedAt}\n\n60 seconds per mode; 20 requests/s total (10 per endpoint). Kill requested at 15 s; restart requested at 40 s. Percentages and nearest-rank latencies include all responses and network/time-out errors across both routes. Recovery is the first successful /users request dispatched after the restart request, measured from that request; Not observed means no recovery within the round. Background traffic is paused.\n\n${table(state.results)}\n\nAction timing (seconds from round start):\n\n\`\`\`json\n${JSON.stringify(state.results.map(({ mode, events, routes }) => ({ mode, events, routes })), null, 2)}\n\`\`\`\n`);
      } catch (error) { failure = error; }
    }
    state.status = failure ? 'failed' : 'complete';
    state.phase = failure ? failure.message : 'Saved to experiments/results.md';
  }

  return {
    snapshot,
    running: () => state.status === 'running',
    start() {
      if (state.status === 'running') throw new Error('Experiment already running');
      state = { status: 'running', phase: 'Preparing', startedAt: new Date().toISOString(), results: [] };
      stopping = false;
      task = run().catch(error => { state.status = 'failed'; state.phase = error.message; });
    },
    async stop() { stopping = true; controller?.abort(); await task; },
  };
}

module.exports = { createExperiment, summarize, table };
