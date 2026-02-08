#!/usr/bin/env node
/**
 * Safe migration helper: ensure `points_transactions` table and `transaction_type` column exist.
 * Usage: DATABASE_URL="postgres://..." node scripts/ensure_points_schema.js
 */
const { Client } = require('pg');

const POINTS_TABLE_CREATE = `
CREATE TABLE IF NOT EXISTS points_transactions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  challenge_id INTEGER,
  transaction_type VARCHAR,
  amount BIGINT NOT NULL,
  reason TEXT,
  blockchain_tx_hash VARCHAR,
  block_number INTEGER,
  chain_id INTEGER DEFAULT 84532,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL must be set. Example: export DATABASE_URL="postgres://user:pass@host:5432/db"');
    process.exit(2);
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    // Check if table exists
    const tableRes = await client.query(
      `SELECT to_regclass('public.points_transactions') as tbl;`
    );
    const tableExists = tableRes.rows[0].tbl !== null;

    if (!tableExists) {
      console.log('points_transactions table not found — creating table (safe create)...');
      await client.query(POINTS_TABLE_CREATE);
      await client.query("CREATE INDEX IF NOT EXISTS idx_points_user_id ON points_transactions(user_id);");
      await client.query("CREATE INDEX IF NOT EXISTS idx_points_challenge_id ON points_transactions(challenge_id);");
      await client.query("CREATE INDEX IF NOT EXISTS idx_points_tx_hash ON points_transactions(blockchain_tx_hash);");
      await client.query("CREATE INDEX IF NOT EXISTS idx_points_created_at ON points_transactions(created_at);");
      console.log('Created points_transactions table and indexes.');
    } else {
      console.log('points_transactions table exists.');
      // Check for column
      const colRes = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name='points_transactions' AND column_name='transaction_type';`
      );
      const colExists = colRes.rows.length > 0;
      if (!colExists) {
        console.log('transaction_type column missing — adding column safely...');
        try {
          await client.query('BEGIN');
          await client.query("ALTER TABLE points_transactions ADD COLUMN transaction_type VARCHAR;");
          // Backfill any NULLs with 'unknown' to satisfy NOT NULL later if desired
          await client.query("UPDATE points_transactions SET transaction_type = 'unknown' WHERE transaction_type IS NULL;");
          await client.query("ALTER TABLE points_transactions ALTER COLUMN transaction_type SET NOT NULL;");
          await client.query("CREATE INDEX IF NOT EXISTS idx_points_tx_type ON points_transactions(transaction_type);");
          await client.query('COMMIT');
          console.log('Added transaction_type column, backfilled, set NOT NULL, and created index.');
        } catch (err) {
          await client.query('ROLLBACK');
          console.error('Failed to add column transaction_type:', err.message || err);
          process.exit(1);
        }
      } else {
        console.log('transaction_type column already present.');
      }
    }

    // Final check: count rows
    const cnt = await client.query('SELECT COUNT(*) AS c FROM points_transactions;');
    console.log('points_transactions row count:', cnt.rows[0].c);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Error ensuring points schema:', err.message || err);
  process.exit(1);
});
