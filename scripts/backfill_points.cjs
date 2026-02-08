#!/usr/bin/env node
/**
 * Safe backfill for points_transactions.
 * Usage examples:
 *   # Dry-run using .env DATABASE_URL and provide user id
 *   USER_ID="did:privy:cmk2cxona01r4jo0d5v22cqy4" node scripts/backfill_points.cjs
 *
 *   # Apply changes (destructive) - requires FORCE=1
 *   USER_ID="..." FORCE=1 node scripts/backfill_points.cjs
 */
const { Client } = require('pg');

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const userId = process.env.USER_ID || process.argv[2];
  const force = process.env.FORCE === '1' || process.argv.includes('--force');

  if (!dbUrl) {
    console.error('DATABASE_URL must be set (from .env or env var)');
    process.exit(2);
  }
  if (!userId) {
    console.error('USER_ID must be provided (env USER_ID or first arg)');
    process.exit(2);
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    // Ensure ledger exists
    const ledgerRes = await client.query('SELECT id, points_balance, total_points_earned FROM user_points_ledgers WHERE user_id = $1 LIMIT 1', [userId]);
    if (ledgerRes.rowCount === 0) {
      console.error('No ledger row found for user:', userId);
      process.exit(1);
    }
    const ledger = ledgerRes.rows[0];
    const ledgerPoints = Number(ledger.points_balance || 0);

    // Check existing txs
    const txCountRes = await client.query('SELECT COUNT(*) AS c FROM points_transactions WHERE user_id = $1', [userId]);
    const existing = Number(txCountRes.rows[0].c || 0);

    console.log('User:', userId);
    console.log('Ledger points_balance:', ledgerPoints);
    console.log('Existing points_transactions rows for user:', existing);

    if (existing > 0 && !force) {
      console.log('\nAborting: transactions already exist for this user.');
      console.log('If you really want to insert a backfill, re-run with FORCE=1 to proceed.');
      process.exit(0);
    }

    if (ledgerPoints <= 0) {
      console.log('Ledger balance is zero or missing; nothing to backfill.');
      process.exit(0);
    }

    // Prepare one backfill transaction matching ledger total
    const tx = {
      user_id: userId,
      challenge_id: null,
      transaction_type: 'backfill',
      amount: ledgerPoints,
      reason: 'Backfill created to reconcile ledger (script)',
    };

    const dryRun = !force;
    console.log('\nPrepared backfill transaction:');
    console.table(tx);

    if (dryRun) {
      console.log('\nDRY RUN (no changes). To apply the backfill set FORCE=1 and re-run.');
      process.exit(0);
    }

    // Insert and call update function inside a transaction
    try {
      await client.query('BEGIN');
      const insertSql = `INSERT INTO points_transactions (user_id, challenge_id, transaction_type, amount, reason, created_at) VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING id`;
      const insertRes = await client.query(insertSql, [tx.user_id, tx.challenge_id, tx.transaction_type, tx.amount, tx.reason]);
      console.log('Inserted points_transactions id:', insertRes.rows[0].id);

      // Call stored procedure to update ledger
      try {
        await client.query('SELECT update_user_points_balance($1)', [userId]);
        console.log('Called update_user_points_balance for user');
      } catch (err) {
        console.warn('Warning: failed to call update_user_points_balance:', err.message || err);
      }

      await client.query('COMMIT');
      console.log('Backfill applied successfully.');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Failed to apply backfill:', err.message || err);
      process.exit(1);
    }

  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err.message || err);
  process.exit(1);
});
