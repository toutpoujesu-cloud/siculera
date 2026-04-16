/**
 * Siculera Keep-Alive Worker
 *
 * Pings api.siculera.com/health every 10 minutes via Cloudflare cron trigger.
 * This prevents the Render free-tier instance from spinning down.
 *
 * Deploy once via Cloudflare dashboard — see README.md for instructions.
 */

const HEALTH_URL = 'https://api.siculera.com/health';

export default {
  // Cron trigger — runs every 10 minutes (configured in wrangler.toml)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(ping());
  },

  // Also handles direct HTTP fetch (for manual testing)
  async fetch(request, env, ctx) {
    const result = await ping();
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

async function ping() {
  const start = Date.now();
  try {
    const res = await fetch(HEALTH_URL, {
      method: 'GET',
      headers: { 'User-Agent': 'Siculera-KeepAlive/1.0' },
      signal: AbortSignal.timeout(15000)
    });
    const latency = Date.now() - start;
    const body = await res.text();
    console.log(`[keep-alive] ${res.status} in ${latency}ms — ${body.slice(0, 80)}`);
    return { ok: res.ok, status: res.status, latency_ms: latency };
  } catch (err) {
    console.error('[keep-alive] ping failed:', err.message);
    return { ok: false, error: err.message };
  }
}
