/**
 * Siculera AI Chat — Database Migration Runner
 * Run: node database/migrate_chat.js
 *      npm run db:migrate:chat
 */
'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const fs       = require('fs');
const path     = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Siculera AI Chat — Database Migration       ║');
  console.log('╚══════════════════════════════════════════════╝');

  // Test connection first
  try {
    const { rows } = await pool.query('SELECT current_database() AS db, version()');
    console.log(`\n✓ Connected to database: ${rows[0].db}`);
    console.log(`  PostgreSQL: ${rows[0].version.split(' ').slice(0, 2).join(' ')}`);
  } catch (err) {
    console.error('\n✗ Database connection failed!');
    console.error('  Error:', err.message);
    console.error('\n  Please check your DATABASE_URL in .env:');
    console.error('  Current value:', (process.env.DATABASE_URL || 'NOT SET').replace(/:([^:@]+)@/, ':***@'));
    console.error('\n  Make sure PostgreSQL is running and credentials are correct.');
    process.exit(1);
  }

  const schemaPath = path.join(__dirname, 'schema_chat.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  // Split on semicolons but keep statement content
  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`\n  Running ${statements.length} statements...\n`);

  let ok = 0, skipped = 0;
  for (const stmt of statements) {
    if (!stmt.trim()) continue;
    try {
      await pool.query(stmt);
      // Print only the first line of each statement
      const preview = stmt.split('\n')[0].slice(0, 70);
      console.log(`  ✓ ${preview}${stmt.split('\n')[0].length > 70 ? '…' : ''}`);
      ok++;
    } catch (err) {
      if (err.message.includes('already exists')) {
        skipped++;
        // silently skip "already exists" errors — idempotent
      } else {
        console.error(`\n  ✗ Statement failed: ${err.message}`);
        console.error('  SQL:', stmt.slice(0, 200));
        await pool.end();
        process.exit(1);
      }
    }
  }

  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  Migration complete! ${ok} applied, ${skipped} skipped.`);
  console.log(`╚══════════════════════════════════════════════╝\n`);
  await pool.end();
}

migrate();
