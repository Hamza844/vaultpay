import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from './db.js';

const SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
type Auth = Request & { uid?: string; aid?: string };
const r = Router();
const wrap = (f: (q: Auth, s: Response) => Promise<unknown>) =>
  (q: Request, s: Response, n: NextFunction) => f(q, s).catch(n);
const sign = (uid: string, aid: string) => jwt.sign({ uid, aid }, SECRET, { expiresIn: '8h' });
const ref = () => 'VP-' + crypto.randomBytes(5).toString('hex').toUpperCase();
const UUID = /^[0-9a-f-]{36}$/i;

function auth(q: Auth, s: Response, n: NextFunction) {
  try {
    const p = jwt.verify((q.headers.authorization || '').replace('Bearer ', ''), SECRET) as { uid: string; aid: string };
    q.uid = p.uid; q.aid = p.aid; n();
  } catch { s.status(401).json({ error: 'Please sign in to continue' }); }
}

const TX = `SELECT t.id, t.reference, t.type, t.amount::float8 AS amount, t.note, t.status, t.created_at,
  CASE WHEN t.to_account_id = $1 THEN 'credit' ELSE 'debit' END AS direction,
  fu.full_name AS from_name, fa.account_number AS from_number,
  tu.full_name AS to_name, ta.account_number AS to_number
  FROM transactions t
  LEFT JOIN accounts fa ON fa.id = t.from_account_id LEFT JOIN users fu ON fu.id = fa.user_id
  LEFT JOIN accounts ta ON ta.id = t.to_account_id LEFT JOIN users tu ON tu.id = ta.user_id
  WHERE (t.from_account_id = $1 OR t.to_account_id = $1)`;

r.get('/health', (_q, s) => s.json({ ok: true }));

r.post('/auth/register', wrap(async (q, s) => {
  const { fullName, email, password } = q.body || {};
  const em = String(email || '').trim().toLowerCase();
  if (String(fullName || '').trim().length < 2 || !/^\S+@\S+\.\S+$/.test(em) || String(password || '').length < 8)
    return s.status(400).json({ error: 'Enter your name, a valid email and a password of at least 8 characters' });
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const u = await c.query('INSERT INTO users(email, password_hash, full_name) VALUES($1,$2,$3) RETURNING id',
      [em, await bcrypt.hash(String(password), 10), String(fullName).trim()]);
    const a = await c.query('INSERT INTO accounts(user_id, account_number, balance) VALUES($1,$2,5000) RETURNING id',
      [u.rows[0].id, 'VP' + crypto.randomInt(1e9, 1e10)]);
    await c.query("INSERT INTO transactions(reference, type, to_account_id, amount, note) VALUES($1,'deposit',$2,5000,'Welcome bonus')",
      [ref(), a.rows[0].id]);
    await c.query('COMMIT');
    s.status(201).json({ token: sign(u.rows[0].id, a.rows[0].id) });
  } catch (e: any) {
    await c.query('ROLLBACK');
    if (e.code === '23505') return s.status(409).json({ error: 'An account with this email already exists' });
    throw e;
  } finally { c.release(); }
}));

r.post('/auth/login', wrap(async (q, s) => {
  const em = String(q.body?.email || '').trim().toLowerCase();
  const { rows } = await pool.query(
    'SELECT u.id uid, u.password_hash, a.id aid FROM users u JOIN accounts a ON a.user_id = u.id WHERE u.email = $1', [em]);
  if (!rows[0] || !(await bcrypt.compare(String(q.body?.password || ''), rows[0].password_hash)))
    return s.status(401).json({ error: 'Email or password is incorrect' });
  s.json({ token: sign(rows[0].uid, rows[0].aid) });
}));

const PROFILE = `SELECT u.full_name "fullName", u.email, u.phone, u.created_at "createdAt",
  a.account_number "accountNumber", a.balance::float8 balance, a.currency
  FROM users u JOIN accounts a ON a.user_id = u.id WHERE u.id = $1`;

r.get('/profile', auth, wrap(async (q, s) => s.json((await pool.query(PROFILE, [q.uid])).rows[0])));

r.put('/profile', auth, wrap(async (q, s) => {
  const name = String(q.body?.fullName || '').trim();
  const phone = String(q.body?.phone || '').trim();
  if (name.length < 2) return s.status(400).json({ error: 'Full name must be at least 2 characters' });
  if (phone && !/^[0-9+()\-\s]{7,20}$/.test(phone)) return s.status(400).json({ error: 'Enter a valid phone number' });
  await pool.query('UPDATE users SET full_name = $1, phone = $2 WHERE id = $3', [name, phone || null, q.uid]);
  s.json((await pool.query(PROFILE, [q.uid])).rows[0]);
}));

r.get('/dashboard', auth, wrap(async (q, s) => {
  const [profile, chart, recent] = await Promise.all([
    pool.query(PROFILE, [q.uid]),
    pool.query(`SELECT to_char(m, 'Mon') AS label,
        COALESCE(SUM(CASE WHEN t.to_account_id = $1 THEN t.amount END), 0)::float8 AS income,
        COALESCE(SUM(CASE WHEN t.from_account_id = $1 THEN t.amount END), 0)::float8 AS spent
      FROM generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m
      LEFT JOIN transactions t ON date_trunc('month', t.created_at) = m AND (t.from_account_id = $1 OR t.to_account_id = $1)
      GROUP BY m ORDER BY m`, [q.aid]),
    pool.query(`${TX} ORDER BY t.created_at DESC LIMIT 5`, [q.aid])
  ]);
  s.json({ profile: profile.rows[0], chart: chart.rows, recent: recent.rows });
}));

r.get('/transactions', auth, wrap(async (q, s) => {
  const p: unknown[] = [q.aid];
  let w = '';
  if (q.query.direction === 'credit') w += ' AND t.to_account_id = $1';
  if (q.query.direction === 'debit') w += ' AND t.from_account_id = $1';
  const term = String(q.query.q || '').trim();
  if (term) {
    p.push('%' + term + '%');
    const n = `$${p.length}`;
    w += ` AND (t.note ILIKE ${n} OR t.reference ILIKE ${n} OR fu.full_name ILIKE ${n} OR tu.full_name ILIKE ${n})`;
  }
  p.push(Math.min(Number(q.query.limit) || 100, 200));
  s.json((await pool.query(`${TX}${w} ORDER BY t.created_at DESC LIMIT $${p.length}`, p)).rows);
}));

r.get('/transactions/:id', auth, wrap(async (q, s) => {
  const id = String(q.params.id);
  const row = UUID.test(id) ? (await pool.query(`${TX} AND t.id = $2`, [q.aid, id])).rows[0] : null;
  if (!row) return s.status(404).json({ error: 'Transaction not found' });
  s.json(row);
}));

r.post('/transfers', auth, wrap(async (q, s) => {
  const num = String(q.body?.accountNumber || '').trim().toUpperCase();
  const amount = Math.round(Number(q.body?.amount) * 100) / 100;
  const note = String(q.body?.note || '').trim().slice(0, 140) || null;
  if (!/^VP\d{10}$/.test(num)) return s.status(400).json({ error: 'Enter a valid VaultPay account number (VP + 10 digits)' });
  if (!(amount > 0) || amount > 1_000_000) return s.status(400).json({ error: 'Enter an amount greater than 0' });
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const to = (await c.query('SELECT id FROM accounts WHERE account_number = $1', [num])).rows[0];
    if (!to) { await c.query('ROLLBACK'); return s.status(404).json({ error: 'Recipient account not found' }); }
    if (to.id === q.aid) { await c.query('ROLLBACK'); return s.status(400).json({ error: 'You cannot send money to your own account' }); }
    const locked = (await c.query('SELECT id, balance::float8 balance FROM accounts WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [[q.aid, to.id]])).rows;
    const me = locked.find((a) => a.id === q.aid);
    if (!me || me.balance < amount) { await c.query('ROLLBACK'); return s.status(422).json({ error: 'Insufficient funds' }); }
    await c.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, q.aid]);
    await c.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, to.id]);
    const t = await c.query("INSERT INTO transactions(reference, type, from_account_id, to_account_id, amount, note) VALUES($1,'transfer',$2,$3,$4,$5) RETURNING id, reference",
      [ref(), q.aid, to.id, amount, note]);
    await c.query('COMMIT');
    s.status(201).json(t.rows[0]);
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}));

r.use((_q, s) => s.status(404).json({ error: 'Not found' }));
r.use((e: unknown, _q: Request, s: Response, _n: NextFunction) => {
  console.error(e);
  s.status(500).json({ error: 'Something went wrong. Please try again.' });
});

export default r;
