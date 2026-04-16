/**
 * Siculera core schema migration runner
 * Run: npm run db:migrate
 */
'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  try {
    console.log('Running schema.sql...');
    await pool.query(sql);
    console.log('Core schema migration completed successfully.');
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Core schema migration failed:', err.message);
  process.exit(1);
});
