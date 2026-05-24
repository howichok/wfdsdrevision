#!/usr/bin/env node
/**
 * Promote a user to Special Admin (SA). Only one SA can exist.
 * Usage: npm run seed:sa -- admin@school.edu
 */
const { Pool } = require("pg");

const email = process.argv[2];

if (!email) {
  console.error("Usage: npm run seed:sa -- <email>");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run with: dotenv -e .env.local -- node scripts/seed-sa.js <email>");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const existingSa = await pool.query(
    `SELECT id, email FROM users WHERE role = 'SA' LIMIT 1`
  );

  const target = await pool.query(
    `SELECT id, email FROM users WHERE email = $1 LIMIT 1`,
    [email]
  );

  if (target.rows.length === 0) {
    console.error(`No user found with email: ${email}`);
    console.error("The user must sign up first, then run this script.");
    process.exit(1);
  }

  if (existingSa.rows.length > 0 && existingSa.rows[0].id !== target.rows[0].id) {
    console.error(`SA already assigned to ${existingSa.rows[0].email}. Demote them first.`);
    process.exit(1);
  }

  await pool.query(
    `UPDATE users SET role = 'SA', updated_at = NOW() WHERE id = $1`,
    [target.rows[0].id]
  );

  console.log(`✓ ${email} is now Special Admin (SA)`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
