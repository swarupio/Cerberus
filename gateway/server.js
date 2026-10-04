const http = require('node:http');

const port = process.env.PORT || 3000;
const downstreamRoutes = {
  '/users': { service: 'user-service', url: 'http://user-service:3000/users' },
  '/orders': { service: 'order-service', url: 'http://order-service:3000/orders' },
};

const server = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  const downstream = downstreamRoutes[request.url];
  if (request.method === 'GET' && downstream) {
    try {
      const result = await fetch(downstream.url, {
        signal: AbortSignal.timeout(3000),
      });
      if (!result.ok) {
        throw new Error(`Downstream returned HTTP ${result.status}`);
      }
      const body = await result.json();
      response.writeHead(result.status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(body));
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
