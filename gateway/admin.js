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

function parseBreakerSettings(body, current) {
  const settings = ['on', 'off'].includes(body) ? { breaker: body } : JSON.parse(body);
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)
    || !Object.keys(settings).length
    || Object.keys(settings).some(key => !['breaker', 'resetTimeoutSeconds'].includes(key))) {
    throw new Error('Use on/off or JSON with breaker and/or resetTimeoutSeconds');
  }
  if (settings.breaker !== undefined && !['on', 'off'].includes(settings.breaker)) {
    throw new Error('breaker must be on or off');
  }
  if (settings.resetTimeoutSeconds !== undefined
    && (typeof settings.resetTimeoutSeconds !== 'number' || !Number.isFinite(settings.resetTimeoutSeconds)
      || settings.resetTimeoutSeconds < 1 || settings.resetTimeoutSeconds > 300)) {
    throw new Error('resetTimeoutSeconds must be a number from 1 to 300');
  }
  return { ...current, ...settings };
}

module.exports = { isLocalAdmin, parseBreakerSettings };
