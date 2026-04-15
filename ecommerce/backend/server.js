'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env'), override: true });

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const util       = require('util');

// ── Embedded PostgreSQL (dev only — no system PostgreSQL needed) ─────────────
const { startEmbeddedPostgres } = require('../database/start-db');

const db              = require('./models/db');
const authRouter      = require('./routes/auth');
const adminRouter     = require('./routes/admin');
const productRoutes   = require('./routes/products');
const orderRoutes     = require('./routes/orders');
const userRoutes      = require('./routes/users');
const paymentRoutes   = require('./routes/payments');
const chatRoutes      = require('./routes/chat');
const chatAdminRoutes = require('./routes/chatAdmin');
const { requireAdminAuth } = require('./middleware/auth');

const app  = express();
const PORT = parseInt(process.env.PORT, 10) || 4000;
const ENV  = process.env.NODE_ENV || 'development';
const USE_SYSTEM_POSTGRES = process.env.USE_SYSTEM_POSTGRES === 'true' || process.env.SKIP_EMBEDDED_PG === 'true';

/* ── Security headers ──────────────────────────────────────────────────────── */
app.use(helmet({ contentSecurityPolicy: false }));

/* ── CORS ──────────────────────────────────────────────────────────────────── */
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return cb(null, true);
    // In development, allow all localhost origins regardless of port
    if (ENV !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
      return cb(null, true);
    }
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

/* ── Rate limiting ─────────────────────────────────────────────────────────── */
const globalLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 minutes
  max:             100,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many authentication attempts, please try again later.' }
});

// Chat-specific limiter (per-session rate limiting also done in sessionManager)
const chatLimiter = rateLimit({
  windowMs:        60 * 1000, // 1 minute
  max:             parseInt(process.env.CHAT_RATE_LIMIT_PER_MIN, 10) || 20,
  keyGenerator:    (req) => req.body?.session_token || req.ip,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many messages. Please wait a moment.' }
});

app.use('/api', globalLimiter);
app.use('/api/auth', authLimiter);

/* ── Raw body for Stripe webhooks (must come before JSON parser) ─────────── */
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

/* ── Body parsing ──────────────────────────────────────────────────────────── */
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

/* ── Request logging ───────────────────────────────────────────────────────── */
if (ENV !== 'test') {
  app.use(morgan(ENV === 'production' ? 'combined' : 'dev'));
}

/* ── Static file serving ───────────────────────────────────────────────────── */
// Admin panel
app.use('/admin', express.static(path.join(__dirname, '../admin'), {
  index: 'login.html',
  fallthrough: true
}));

// Uploaded product images (served publicly — chat-docs are explicitly excluded)
app.use('/uploads', (req, res, next) => {
  // Block access to chat-docs (knowledge base files are NOT public)
  if (req.path.startsWith('/chat-docs')) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}, express.static(path.join(__dirname, '../uploads'), {
  maxAge: '7d',
  fallthrough: true
}));

// Customer-facing frontend
app.use('/', express.static(path.join(__dirname, '../frontend'), {
  index: 'index1.html',
  fallthrough: true
}));

/* ── Health check ──────────────────────────────────────────────────────────── */
app.get('/health', (req, res) => {
  res.json({
    status:  'ok',
    service: 'siculera-api',
    version: '1.0.0',
    env:     ENV
  });
});

/* ── API Routes ────────────────────────────────────────────────────────────── */

// Auth (admin login/logout/me/change-password)
app.use('/api/auth/admin', authRouter);

// Protected admin back-office API (middleware applied inside the router too)
app.use('/api/admin', requireAdminAuth, adminRouter);

// Public-facing routes
app.use('/api/products', productRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/payments', paymentRoutes);

// AI Chat (public widget endpoint)
app.use('/api/chat', chatLimiter, chatRoutes);

// AI Chat admin (protected)
app.use('/api/admin/chat', requireAdminAuth, chatAdminRoutes);

/* ── SPA fallback for admin panel ──────────────────────────────────────────── */
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/login.html'));
});
app.get('/admin/', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/login.html'));
});
app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/dashboard.html'));
});
app.get('/admin/*', (req, res) => {
  const file = path.join(__dirname, '../admin', path.basename(req.path));
  res.sendFile(file, err => {
    if (err) res.sendFile(path.join(__dirname, '../admin/login.html'), e => {
      if (e) res.status(404).json({ error: 'Admin panel not found' });
    });
  });
});

/* ── 404 handler ───────────────────────────────────────────────────────────── */
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

/* ── Global error handler ──────────────────────────────────────────────────── */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // CORS errors
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ error: err.message });
  }
  console.error('[unhandled error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

/* ── Startup ───────────────────────────────────────────────────────────────── */
async function start() {
  // Boot embedded PostgreSQL in development (no system install required)
  if (process.env.NODE_ENV !== 'production' && !USE_SYSTEM_POSTGRES) {
    try {
      await startEmbeddedPostgres();
    } catch (e) {
      const message = (e?.message ?? String(e)) || 'unknown embedded Postgres startup failure';
      console.warn('[DB] Embedded PG start warning (may already be running or binary failed):', message);
      if (message.includes('3221225781') || message.includes('init script exited')) {
        console.warn('[DB] If you are on Windows, install the Microsoft Visual C++ Redistributable 2015-2022 or use a local PostgreSQL server with USE_SYSTEM_POSTGRES=true.');
      }
      if (!USE_SYSTEM_POSTGRES) {
        console.warn('[DB] Continuing startup; database connection will still be tested via DATABASE_URL.');
      }
    }
  } else if (USE_SYSTEM_POSTGRES) {
    console.log('[DB] Skipping embedded PostgreSQL startup because USE_SYSTEM_POSTGRES=true');
  }

  // Test DB connection before accepting traffic
  let dbStatus = 'unknown';
  try {
    await db.query('SELECT 1');
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = `error: ${err?.message ?? util.inspect(err, { depth: null })}`;
    console.warn('[DB] Connection test failed:', util.inspect(err, { depth: null }));
  }

  function listenOnPort(port) {
    return new Promise((resolve, reject) => {
      const server = app.listen(port, () => resolve(server));
      server.on('error', reject);
    });
  }

  const portsToTry = [PORT, 4001, 4002, 4003];
  async function startHttpServer(index = 0) {
    const port = portsToTry[index];
    if (port == null) {
      throw new Error(`Unable to bind to any port: ${portsToTry.join(', ')}`);
    }
    try {
      const server = await listenOnPort(port);
      console.log('═══════════════════════════════════════════');
      console.log(`  Siculera API`);
      console.log(`  Environment : ${ENV}`);
      console.log(`  Port        : ${port}`);
      console.log(`  Database    : ${dbStatus}`);
      console.log('═══════════════════════════════════════════');
      return server;
    } catch (err) {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[server] Port ${port} is already in use. Trying next available port...`);
        return await startHttpServer(index + 1);
      }
      throw err;
    }
  }

  const server = await startHttpServer();

  /* ── GDPR Data Retention Cleanup (daily) ──────────────────────────────── */
  async function runRetentionCleanup() {
    try {
      const { rows } = await db.query("SELECT value FROM settings WHERE key = 'gdpr_config'");
      const gdprCfg  = rows.length ? JSON.parse(rows[0].value) : {};
      const days     = parseInt(gdprCfg.data_retention_days) || 365;
      const result   = await db.query(
        `DELETE FROM chat_messages
         WHERE created_at < NOW() - INTERVAL '${days} days'`
      );
      if (result.rowCount > 0) {
        console.log(`[GDPR cleanup] Deleted ${result.rowCount} chat messages older than ${days} days.`);
      }
    } catch (err) {
      console.warn('[GDPR cleanup] Error:', err?.message ?? String(err));
    }
  }
  // Run once at startup then every 24 hours
  runRetentionCleanup();
  setInterval(runRetentionCleanup, 24 * 60 * 60 * 1000);

  /* ── Graceful shutdown ─────────────────────────────────────────────────── */
  function shutdown(signal) {
    console.log(`\n[${signal}] Graceful shutdown initiated…`);
    server.close(async () => {
      try {
        await db.pool.end();
        console.log('[DB] Connection pool closed.');
      } catch (_) {}
      console.log('[server] Shutdown complete.');
      process.exit(0);
    });

    // Force exit after 10 s if connections don't drain
    setTimeout(() => {
      console.error('[server] Forced shutdown after timeout.');
      process.exit(1);
    }, 10000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  return server;
}

start().catch(err => {
  console.error('[startup error]', err);
  process.exit(1);
});

module.exports = app;
