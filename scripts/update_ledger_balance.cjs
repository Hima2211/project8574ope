#!/usr/bin/env node
/**
 * Manually update user points ledger balance after backfill.
 * Usage: USER_ID="did:privy:..." node scripts/update_ledger_balance.cjs
 */
const { Client } = require('pg');

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const userId = process.env.USER_ID || process.argv[2];

  if (!dbUrl) {
    console.error('DATABASE_URL must be set');
    process.exit(2);
  }
  if (!userId) {
    console.error('USER_ID must be provided');
    process.exit(2);
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    // Manually calculate balance from transactions
    const calcRes = await client.query(`
      SELECT 
        COALESCE(SUM(CASE 
          WHEN transaction_type IN ('earned_challenge', 'released_escrow', 'transferred_escrow', 'transferred_user')
          THEN amount
          WHEN transaction_type IN ('burned_usage', 'locked_escrow')
          THEN -amount
          ELSE 0
        END), 0) as points_balance,
        COALESCE(SUM(CASE WHEN transaction_type = 'earned_challenge' THEN amount ELSE 0 END), 0) as total_earned,
        COALESCE(SUM(CASE WHEN transaction_type = 'burned_usage' THEN amount ELSE 0 END), 0) as total_burned
      FROM points_transactions
      WHERE user_id = $1
    `, [userId]);

    const { points_balance, total_earned, total_burned } = calcRes.rows[0];
    console.log('Calculated balance:', points_balance);
    console.log('Total earned:', total_earned);
    console.log('Total burned:', total_burned);

    // Ensure ledger entry exists
    await client.query(`
      INSERT INTO user_points_ledgers (user_id, points_balance, total_points_earned, total_points_burned, last_updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        points_balance = EXCLUDED.points_balance,
        total_points_earned = EXCLUDED.total_points_earned,
        total_points_burned = EXCLUDED.total_points_burned,
        last_updated_at = CURRENT_TIMESTAMP
    `, [userId, points_balance, total_earned, total_burned]);

    console.log('Updated ledger for user');

    // Verify update
    const verifyRes = await client.query('SELECT * FROM user_points_ledgers WHERE user_id = $1', [userId]);
    if (verifyRes.rows.length > 0) {
      console.log('Verification - ledger now:', verifyRes.rows[0]);
    }
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
