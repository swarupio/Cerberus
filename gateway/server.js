const http = require('node:http');
const CircuitBreaker = require('opossum');
const { isLocalAdmin, parseBreakerSettings } = require('./admin');
const { instrumentRequest, serveMetrics, setCircuitState } = require('./metrics');

const port = process.env.PORT || 3000;
const downstreamRoutes = {
  '/users': { service: 'user-service', url: 'http://user-service:3000/users' },
  '/orders': { service: 'order-service', url: 'http://order-service:3000/orders' },
};

async function callDownstream(url) {
  const result = await fetch(url, { signal: AbortSignal.timeout(3000) });
  if (!result.ok) {
    throw new Error(`Downstream returned HTTP ${result.status}`);
  }
  return { status: result.status, body: await result.json() };
}

const userBreaker = new CircuitBreaker(callDownstream, {
  name: 'user-service',
  timeout: 4000,
  resetTimeout: 30000,
  // The PRD requires consecutive failures, rather than a rolling error percentage.
  errorThresholdPercentage: 100,
});
let consecutiveFailures = 0;
let breakerEnabled = true;
let userCircuitState = 'closed';
setCircuitState(userCircuitState);
for (const [event, state] of [['open', 'open'], ['halfOpen', 'half_open'], ['close', 'closed']]) {
  userBreaker.on(event, () => {
    userCircuitState = state;
    setCircuitState(state);
    console.log(`Circuit breaker user-service: ${state}`);
  });
}
userBreaker.on('success', () => { consecutiveFailures = 0; });
userBreaker.on('failure', (error) => {
  consecutiveFailures += 1;
  console.error(`Call to user-service failed (${consecutiveFailures} consecutive): ${error.message}`);
  if (consecutiveFailures >= 3) userBreaker.open();
});
userBreaker.fallback(() => ({
  status: 503,
  body: {
    error: 'User service temporarily unavailable',
    service: 'user-service',
    circuit: userCircuitState,
  },
}));

const server = http.createServer(async (request, response) => {
  if (request.url === '/admin/breaker' && request.method === 'POST') {
    const reply = (code, body) => {
      response.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(body));
    };
    if (!isLocalAdmin(request)) { reply(403, { error: 'Localhost access only' }); return; }
    let body = '';
    try {
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 128) { reply(413, { error: 'Body too large' }); return; }
      }
      const previous = breakerEnabled ? 'on' : 'off';
      const previousResetTimeoutSeconds = userBreaker.options.resetTimeout / 1000;
      const settings = parseBreakerSettings(body, { breaker: previous, resetTimeoutSeconds: previousResetTimeoutSeconds });
      breakerEnabled = settings.breaker === 'on';
      userBreaker.options.resetTimeout = settings.resetTimeoutSeconds * 1000;
      consecutiveFailures = 0;
      userBreaker.close();
      reply(200, { ...settings, previous, previousResetTimeoutSeconds });
    } catch (error) { reply(400, { error: error.message }); }
    return;
  }
  instrumentRequest(request, response, ['/health', '/metrics', '/users', '/orders']);
  if (request.method === 'GET' && request.url === '/metrics') {
    await serveMetrics(response);
    return;
  }

  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  const downstream = downstreamRoutes[request.url];
  if (request.method === 'GET' && downstream) {
    try {
      const result = downstream.service === 'user-service' && breakerEnabled
        ? await userBreaker.fire(downstream.url)
        : await callDownstream(downstream.url);
      response.writeHead(result.status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(result.body));
    } catch (error) {
      console.error(`Call to ${downstream.service} failed: ${error.message}`);
      response.writeHead(502, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        error: 'Downstream service unavailable',
        service: downstream.service,
      }));
    }
    return;
  }

  response.writeHead(404, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Gateway listening on port ${port}`);
});
