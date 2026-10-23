const { readFileSync } = require('node:fs');

// Docker's loopback-published port reaches this container from its bridge gateway.
// Container peers have their own addresses and must not access the admin route.
function hostPeers() {
  const peers = new Set(['127.0.0.1', '::1']);
  try {
    for (const line of readFileSync('/proc/net/route', 'utf8').trim().split('\n').slice(1)) {
      const [, destination, gateway] = line.trim().split(/\s+/);
      if (destination === '00000000') {
        peers.add(gateway.match(/../g).reverse().map(byte => parseInt(byte, 16)).join('.'));
      }
    }
  } catch {}
  return peers;
}

const peers = hostPeers();
function isLocalAdmin(request) {
  const peer = request.socket.remoteAddress?.replace(/^::ffff:/, '');
  const origins = ['http://127.0.0.1:3000', 'http://localhost:3000'];
  return peers.has(peer)
    && ['127.0.0.1:3000', 'localhost:3000'].includes(request.headers.host)
    && (!request.headers.origin || origins.includes(request.headers.origin));
}

module.exports = { isLocalAdmin };
