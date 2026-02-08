#!/usr/bin/env node
const { Client } = require('pg');

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('Please set DATABASE_URL in your environment.');
    process.exit(2);
  }

  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    const res = await client.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'points_transactions'
       ORDER BY ordinal_position;`
    );
    console.log('Columns for points_transactions:');
    console.table(res.rows);
  } catch (err) {
    console.error('Error querying database:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
