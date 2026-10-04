const http = require('node:http');

const port = process.env.PORT || 3000;

const server = http.createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (request.method === 'GET' && request.url === '/orders') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ orders: [
      { id: 101, userId: 1, item: 'Notebook' },
      { id: 102, userId: 2, item: 'Pen' },
    ] }));
    return;
  }

  response.writeHead(404, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Order service listening on port ${port}`);
});
