const http = require('node:http');
const { instrumentRequest, serveMetrics } = require('./metrics');

const port = process.env.PORT || 3000;

const server = http.createServer(async (request, response) => {
  instrumentRequest(request, response, ['/health', '/metrics', '/users']);
  if (request.method === 'GET' && request.url === '/metrics') {
    await serveMetrics(response);
    return;
  }

  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (request.method === 'GET' && request.url === '/users') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ users: [
      { id: 1, name: 'Alex' },
      { id: 2, name: 'Sam' },
    ] }));
    return;
  }

  response.writeHead(404, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`User service listening on port ${port}`);
});
