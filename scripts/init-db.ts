import { pool, waitForDb, initDb } from '../server/db.js';
await waitForDb();
await initDb();
await pool.end();
