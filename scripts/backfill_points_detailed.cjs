#!/usr/bin/env node
/**
 * Backfill points transactions from notifications for a user.
 * Dry-run by default. Set FORCE=1 to apply.
 * Usage:
 *   USER_ID="did:privy:..." node scripts/backfill_points_detailed.cjs
 *   USER_ID="..." FORCE=1 node scripts/backfill_points_detailed.cjs
 */
const { Client } = require('pg');

function parseAmountFromText(text) {
  if (!text) return null;
  // Look for patterns like "You earned 60 Bantah Points" or "earned 105 Bantah Points"
  const m = text.match(/earned\s+([\d,]+)\s*(?:Bantah\s*)?Points/i);
  if (m && m[1]) return parseInt(m[1].replace(/,/g, ''), 10);
  // Fallback: first standalone number
  const m2 = text.match(/([\d,]{1,6})/);
  if (m2 && m2[1]) return parseInt(m2[1].replace(/,/g, ''), 10);
  return null;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const userId = process.env.USER_ID || process.argv[2];
  const force = process.env.FORCE === '1' || process.argv.includes('--force');

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
    const notifRes = await client.query(
      `SELECT id, type, title, message, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId]
    );

    if (!notifRes.rows.length) {
      console.log('No notifications found for user:', userId);
      return;
    }

    const candidates = [];
    for (const n of notifRes.rows) {
      const text = (n.title || '') + ' ' + (n.message || '');
      const amount = parseAmountFromText(text);
      if (amount && amount > 0) {
        candidates.push({
          notificationId: n.id,
          createdAt: n.created_at,
          amount,
          reason: text.trim().slice(0, 200),
          inferredType: (n.event || n.type || '').toString(),
        });
      }
    }

    if (!candidates.length) {
      console.log('No point-earning notifications parsed for user.');
      return;
    }

    console.log('Parsed', candidates.length, 'point-earning notifications:');
    console.table(candidates.map(c => ({ amount: c.amount, createdAt: c.createdAt, reason: c.reason })));

    if (!force) {
      console.log('\nDRY RUN: no changes made. Set FORCE=1 to apply inserts.');
      return;
    }

    // For each candidate, ensure we don't already have a matching transaction
    for (const c of candidates) {
      const existsRes = await client.query(
        `SELECT id FROM points_transactions WHERE user_id = $1 AND amount = $2 AND created_at::date = $3::date LIMIT 1`,
        [userId, c.amount, c.createdAt]
      );
      if (existsRes.rowCount > 0) {
        console.log('Skipping existing transaction for amount', c.amount, 'on', c.createdAt);
        continue;
      }

      // Insert as challenge_creation (most points were from challenge creation); insert both type and transaction_type columns
      const insertSql = `INSERT INTO points_transactions (user_id, challenge_id, type, transaction_type, amount, created_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`;
      const insertRes = await client.query(insertSql, [userId, null, 'challenge_creation', 'earned_challenge', c.amount, c.createdAt]);
      console.log('Inserted tx id', insertRes.rows[0].id, 'amount', c.amount);
    }

    // Sync ledger after inserts
    try {
      await client.query('SELECT update_user_points_balance($1)', [userId]);
      console.log('Called update_user_points_balance for user');
    } catch (err) {
      console.warn('Failed to call update_user_points_balance:', err.message || err);
    }

    console.log('Backfill applied for', candidates.length, 'items');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
