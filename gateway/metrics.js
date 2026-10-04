const { Registry, Counter, Histogram, Gauge } = require('prom-client');

const registry = new Registry();
registry.setDefaultLabels({ service: 'gateway' });
const labelNames = ['method', 'route', 'status_code'];
const requests = new Counter({
  name: 'http_requests_total',
  help: 'Total completed HTTP requests.',
  labelNames,
  registers: [registry],
});
const duration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds.',
  labelNames,
  buckets: [0.01, 0.1, 1, 5],
  registers: [registry],
});

const circuitState = new Gauge({
  name: 'gateway_circuit_breaker_state',
  help: 'Current circuit breaker state: 1 for the active state, 0 otherwise.',
  labelNames: ['downstream', 'state'],
  registers: [registry],
});

function setCircuitState(state) {
  for (const candidate of ['closed', 'open', 'half_open']) {
    circuitState.set({ downstream: 'user-service', state: candidate }, Number(candidate === state));
  }
}

function instrumentRequest(request, response, routes) {
  const start = process.hrtime.bigint();
  const route = routes.includes(request.url) ? request.url : 'unmatched';
  response.once('finish', () => {
    const labels = {
      method: httpMethods.includes(request.method) ? request.method : 'OTHER',
      route,
      status_code: String(response.statusCode),
    };
    requests.inc(labels);
    duration.observe(labels, Number(process.hrtime.bigint() - start) / 1e9);
  });
}

const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

async function serveMetrics(response) {
  try {
    const body = await registry.metrics();
    response.writeHead(200, { 'Content-Type': registry.contentType });
    response.end(body);
  } catch (error) {
    console.error('Metrics collection failed:', error);
    response.writeHead(500, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Metrics collection failed' }));
  }
}

module.exports = { instrumentRequest, serveMetrics, setCircuitState };
