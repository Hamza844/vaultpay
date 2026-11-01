import pg from 'pg';
import fs from 'fs';
import path from 'path';

export const pool = new pg.Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || 'vaultpay',
        password: process.env.PGPASSWORD || 'vaultpay',
        database: process.env.PGDATABASE || 'vaultpay'
      }
);

export async function waitForDb(tries = 30) {
  for (let i = 1; ; i++) {
    try { await pool.query('SELECT 1'); return; }
    catch (e) {
      if (i >= tries) throw e;
      console.log(`Waiting for PostgreSQL (${i}/${tries})...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

export async function initDb() {
  const dir = path.resolve(process.cwd(), 'sql');
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await pool.query(fs.readFileSync(path.join(dir, f), 'utf8'));
    console.log('Applied', f);
  }
}
