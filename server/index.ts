import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import api from './routes.js';
import { waitForDb, initDb } from './db.js';

const app = express();
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
app.use(express.json());
app.use('/api', api);
app.use(express.static(dist));
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));

const port = Number(process.env.PORT || 3000);
await waitForDb();
if (process.env.AUTO_INIT_DB !== 'false') await initDb();
app.listen(port, '0.0.0.0', () => console.log(`VaultPay listening on :${port}`));
