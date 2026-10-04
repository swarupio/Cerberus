const http = require('node:http');
const CircuitBreaker = require('opossum');
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
      const result = downstream.service === 'user-service'
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
