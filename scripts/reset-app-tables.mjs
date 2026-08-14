import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}

const sql = neon(url);

async function main() {
  await sql.query('DROP TABLE IF EXISTS installments CASCADE');
  await sql.query('DROP TABLE IF EXISTS installment_plans CASCADE');
  await sql.query('DROP TABLE IF EXISTS transactions CASCADE');
  await sql.query('DROP TABLE IF EXISTS transfers CASCADE');
  await sql.query('DROP TABLE IF EXISTS savings CASCADE');
  await sql.query('DROP TABLE IF EXISTS accounts CASCADE');
  await sql.query('DROP TABLE IF EXISTS categories CASCADE');
  await sql.query('DROP TABLE IF EXISTS sessions CASCADE');
  // keep users
  console.log('Dropped app tables (users kept)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
