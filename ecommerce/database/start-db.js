/**
 * start-db.js  --  Boots an embedded PostgreSQL server for development.
 * Run once before starting the backend, or import at the top of server.js.
 *
 * Usage:  node database/start-db.js
 * Or:     require('./database/start-db')   (from server.js)
 */

'use strict';

const _ep = require('embedded-postgres');
const EmbeddedPostgres = _ep.default || _ep;
const path  = require('path');
const fs    = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });

// Where to store the PostgreSQL data files
const DATA_DIR = path.join(__dirname, '../.pgdata');

// Parse the DATABASE_URL to extract port (default 5432)
function parsePort(url) {
  try { return parseInt(new URL(url).port, 10) || 5432; } catch { return 5432; }
}

// Strip non-ASCII characters from SQL so it runs on WIN1252-encoded clusters
function sanitizeSql(sql) {
  return sql
    .split('\n')
    .map(line => {
      // If it's a comment line, strip all non-ASCII aggressively
      if (line.trimStart().startsWith('--')) {
        return line.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
      }
      // For SQL lines, replace non-ASCII with a space
      return line.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ');
    })
    .join('\n');
}

// Test whether we can authenticate with the stored credentials
async function canAuthenticate(port, user, password) {
  const { Client } = require('pg');
  const client = new Client({ host: 'localhost', port, user, password, database: 'postgres', connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch (e) {
    try { await client.end(); } catch {}
    return false;
  }
}

// Wipe the data directory completely
function wipeDataDir() {
  if (fs.existsSync(DATA_DIR)) {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    console.log('[DB] Wiped stale data directory.');
  }
}

async function startEmbeddedPostgres() {
  const dbUrl    = process.env.DATABASE_URL || 'postgresql://postgres:Admin1234!@localhost:5432/siculera';
  const port     = parsePort(dbUrl);

  // Parse credentials from URL
  let user = 'postgres', password = 'Admin1234!', database = 'siculera';
  try {
    const u = new URL(dbUrl);
    user     = u.username || user;
    password = decodeURIComponent(u.password) || password;
    database = u.pathname.replace('/', '') || database;
  } catch {}

  console.log('[DB] Starting embedded PostgreSQL on port', port, '...');

  async function tryStart(isRetry) {
    const alreadyInit = fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'));

    const pg = new EmbeddedPostgres({
      databaseDir: DATA_DIR,
      user,
      password,
      port,
      persistent: true,
    });

    try {
      if (!alreadyInit) {
        console.log('[DB] Initialising new database cluster...');
        await pg.initialise();
      }
      await pg.start();
    } catch (e) {
      if (!isRetry) {
        console.warn('[DB] Start failed, wiping and reinitialising:', e);
        console.warn('[DB] Start failed stack:', e?.stack ?? String(e));
        try { await pg.stop(); } catch (stopErr) { console.warn('[DB] Failed to stop PG after start failure:', stopErr); }
        wipeDataDir();
        return tryStart(true);
      }
      throw e;
    }

    // Verify authentication matches before proceeding
    const authOk = await canAuthenticate(port, user, password);
    if (!authOk) {
      if (!isRetry) {
        console.warn('[DB] Auth check failed -- data directory has different credentials. Reinitialising...');
        try { await pg.stop(); } catch {}
        wipeDataDir();
        return tryStart(true);
      }
      throw new Error('Authentication failed after reinitialisation -- check DATABASE_URL credentials in .env');
    }

    return pg;
  }

  const pg = await tryStart(false);

  console.log('[DB] Embedded PostgreSQL running on port', port);

  // Run schema migrations
  await runMigrations(database, user, password, port);

  // Graceful shutdown
  process.on('SIGINT',  async () => { await pg.stop(); process.exit(0); });
  process.on('SIGTERM', async () => { await pg.stop(); process.exit(0); });

  return pg;
}

async function runMigrations(database, user, password, port) {
  const { Client } = require('pg');

  // Step 1: connect to default 'postgres' DB and create our database if missing
  const setup = new Client({ host: 'localhost', port, user, password, database: 'postgres' });
  try {
    await setup.connect();
    const { rows } = await setup.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`, [database]
    );
    if (!rows.length) {
      await setup.query(`CREATE DATABASE "${database}"`);
      console.log('[DB] Created database:', database);
    }
  } catch (e) {
    console.warn('[DB] Setup warning:', e);
    console.warn('[DB] Setup warning stack:', e?.stack ?? String(e));
  } finally {
    await setup.end().catch(() => {});
  }

  // Step 2: connect to our database and apply schema
  const client = new Client({ host: 'localhost', port, user, password, database });
  try {
    await client.connect();

    // Check if tables already exist
    const { rows } = await client.query(
      `SELECT COUNT(*) as c FROM information_schema.tables WHERE table_schema = 'public'`
    );
    if (parseInt(rows[0].c) > 0) {
      console.log('[DB] Schema already applied (' + rows[0].c + ' tables), skipping');
      await client.end();
      return;
    }

    console.log('[DB] Applying schema migrations...');
    const schemaFiles = [
      path.join(__dirname, 'schema.sql'),
      path.join(__dirname, 'schema_chat.sql'),
    ];

    for (const file of schemaFiles) {
      if (fs.existsSync(file)) {
        // Sanitize SQL: strip non-ASCII characters (box-drawing chars in comments
        // are incompatible with WIN1252-encoded clusters on Windows)
        const raw = fs.readFileSync(file, 'utf8');
        const sql = sanitizeSql(raw);
        try {
          await client.query(sql);
          console.log('[DB] Applied:', path.basename(file));
        } catch (e) {
          console.warn('[DB] Warning applying', path.basename(file), ':', e?.message ?? String(e));
        }
      }
    }
    console.log('[DB] All migrations complete -- database ready');
  } catch (e) {
    console.error('[DB] Migration error:', e);
    console.error('[DB] Migration error stack:', e?.stack ?? String(e));
  } finally {
    await client.end().catch(() => {});
  }
}

// If run directly
if (require.main === module) {
  startEmbeddedPostgres().catch(e => {
    console.error('[DB] Fatal:', e);
    console.error('[DB] Fatal stack:', e?.stack ?? String(e));
    process.exit(1);
  });
}

module.exports = { startEmbeddedPostgres };
