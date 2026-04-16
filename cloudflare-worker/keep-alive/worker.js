/**
 * Siculera Keep-Alive Worker
 *
 * Pings api.siculera.com/health every 10 minutes via Cloudflare cron trigger.
 * This prevents the Render free-tier instance from spinning down.
 */

const HEALTH_URL = 'https://api.siculera.com/health';

addEventListener('fetch', event => {
  event.respondWith(handleFetch());
});

addEventListener('scheduled', event => {
  event.waitUntil(ping());
});

async function handleFetch() {
  const result = await ping();
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function ping() {
  const start = Date.now();
  try {
    const res = await fetch(HEALTH_URL, {
      method: 'GET',
      headers: { 'User-Agent': 'Siculera-KeepAlive/1.0' }
    });
    const latency = Date.now() - start;
    const body = await res.text();
    console.log('[keep-alive]', res.status, 'in', latency + 'ms');
    return { ok: res.ok, status: res.status, latency_ms: latency, body: body.slice(0, 80) };
  } catch (err) {
    console.error('[keep-alive] ping failed:', String(err));
    return { ok: false, error: String(err) };
  }
}


async function ping() {
  const start = Date.now();
  try {
    const res = await fetch(HEALTH_URL, {
      method: 'GET',
      headers: { 'User-Agent': 'Siculera-KeepAlive/1.0' }
    });
    const latency = Date.now() - start;
    const body = await res.text();
    console.log(`[keep-alive] ${res.status} in ${latency}ms`);
    return { ok: res.ok, status: res.status, latency_ms: latency, body: body.slice(0, 80) };
  } catch (err) {
    console.error('[keep-alive] ping failed:', err.message);
    return { ok: false, error: String(err.message || err) };
  }
}
