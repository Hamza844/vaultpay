import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, token, usd, fmtDate, counterparty, Tx, Profile } from './api';
import { useAuth } from './App';

const Field = ({ id, label, error, ...p }: { id: string; label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="field">
    <label htmlFor={id}>{label}</label>
    <input id={id} name={id} aria-invalid={!!error} aria-describedby={error ? id + '-e' : undefined} {...p} />
    {error && <span id={id + '-e'} className="err" role="alert">{error}</span>}
  </div>
);
const Skeleton = ({ h = 80 }: { h?: number }) => <div className="skeleton" style={{ height: h }} aria-hidden="true" />;
const Head = ({ title, sub }: { title: string; sub?: string }) => <header className="head"><h1>{title}</h1>{sub && <p>{sub}</p>}</header>;
const Amount = ({ t }: { t: Tx }) => <span className={t.direction}>{t.direction === 'credit' ? '+' : '−'}{usd(t.amount)}</span>;

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/dashboard" replace />;
  const reg = mode === 'register';
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setErr(''); setBusy(true);
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      const { token: t } = await api<{ token: string }>(reg ? '/auth/register' : '/auth/login', { method: 'POST', body: f });
      token.set(t); await refresh(); nav('/dashboard');
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="authwrap">
      <form className="card auth" onSubmit={submit} noValidate>
        <Link to="/" className="logo dark">Vault<b>Pay</b></Link>
        <h1>{reg ? 'Open your account' : 'Welcome back'}</h1>
        {reg && <p className="muted">New accounts start with a $5,000 practice balance.</p>}
        {reg && <Field id="fullName" label="Full name" autoComplete="name" required />}
        <Field id="email" label="Email" type="email" autoComplete="email" required />
        <Field id="password" label="Password" type="password" autoComplete={reg ? 'new-password' : 'current-password'} minLength={reg ? 8 : undefined} required />
        {err && <p className="err banner" role="alert">{err}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Please wait…' : reg ? 'Create account' : 'Sign in'}</button>
        <p className="muted">{reg ? <>Already a member? <Link to="/login">Sign in</Link></> : <>New to VaultPay? <Link to="/register">Open an account</Link></>}</p>
      </form>
    </div>
  );
}
export const Register = () => <AuthPage mode="register" />;
export const Login = () => <AuthPage mode="login" />;

export function Landing() {
  const { user } = useAuth();
  const feats: [string, string][] = [
    ['Instant transfers', 'Send money to any VaultPay account number and see it settle immediately.'],
    ['Clear history', 'Search and filter every deposit and payment, with a receipt for each one.'],
    ['Safe by design', 'Balances change inside database transactions with row-level locks, so nothing is double-spent.']
  ];
  return (
    <div className="landing">
      <nav className="top"><span className="logo">Vault<b>Pay</b></span>
        <span>{user ? <Link className="btn primary" to="/dashboard">Open dashboard</Link> : <><Link className="btn ghost" to="/login">Sign in</Link><Link className="btn primary" to="/register">Open account</Link></>}</span>
      </nav>
      <section className="hero">
        <h1>Money that moves<br />at the speed of you.</h1>
        <p>VaultPay is a digital bank account built for sending, tracking and understanding your money, with no fees and no friction.</p>
        <Link className="btn primary lg" to="/register">Open a free account</Link>
        <div className="mock card" aria-hidden="true">
          <small>Available balance</small><strong>$12,480.50</strong>
          <div className="bars">{[40, 65, 50, 80, 60, 90].map((h, i) => <i key={i} style={{ height: h + '%' }} />)}</div>
        </div>
      </section>
      <section className="feats">{feats.map(([t, d]) => <div key={t} className="card"><h3>{t}</h3><p className="muted">{d}</p></div>)}</section>
      <footer>© {new Date().getFullYear()} VaultPay. A practice project, not a real bank.</footer>
    </div>
  );
}

function Chart({ data }: { data: { label: string; income: number; spent: number }[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.spent]));
  return (
    <svg viewBox="0 0 360 160" role="img" aria-label="Income and spending for the last six months" className="chart">
      {data.map((d, i) => {
        const x = 12 + i * 58, h = (v: number) => (v / max) * 110;
        return <g key={d.label}>
          <rect x={x} y={120 - h(d.income)} width="20" height={h(d.income)} rx="3" fill="var(--teal)"><title>{`${d.label} income ${usd(d.income)}`}</title></rect>
          <rect x={x + 23} y={120 - h(d.spent)} width="20" height={h(d.spent)} rx="3" fill="var(--navy2)"><title>{`${d.label} spent ${usd(d.spent)}`}</title></rect>
          <text x={x + 21} y="145" textAnchor="middle">{d.label}</text>
        </g>;
      })}
    </svg>
  );
}

function TxTable({ rows }: { rows: Tx[] }) {
  if (!rows.length) return <p className="muted empty">No transactions yet. <Link to="/send">Send your first payment.</Link></p>;
  return (
    <div className="scroll"><table>
      <thead><tr><th>Date</th><th>Details</th><th className="hide">Reference</th><th className="num">Amount</th></tr></thead>
      <tbody>{rows.map((t) => (
        <tr key={t.id}>
          <td>{fmtDate(t.created_at)}</td>
          <td><Link to={`/transactions/${t.id}`}>{counterparty(t)}</Link><small>{t.note || t.type}</small></td>
          <td className="hide">{t.reference}</td>
          <td className="num"><Amount t={t} /></td>
        </tr>))}</tbody>
    </table></div>
  );
}

type Dash = { profile: Profile; chart: { label: string; income: number; spent: number }[]; recent: Tx[] };
export function Dashboard() {
  const [d, setD] = useState<Dash>();
  const [err, setErr] = useState('');
  useEffect(() => { api<Dash>('/dashboard').then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="err banner" role="alert">{err}</p>;
  if (!d) return <><Head title="Dashboard" /><Skeleton h={140} /><Skeleton h={220} /></>;
  const m = d.chart[d.chart.length - 1];
  return (
    <>
      <Head title={`Hello, ${d.profile.fullName.split(' ')[0]}`} sub="Here is how your money looks today." />
      <div className="grid3">
        <div className="card balance"><small>Available balance</small><strong>{usd(d.profile.balance)}</strong><span>Account {d.profile.accountNumber}</span></div>
        <div className="card"><small>Received this month</small><strong className="credit">{usd(m.income)}</strong></div>
        <div className="card"><small>Sent this month</small><strong className="debit">{usd(m.spent)}</strong></div>
      </div>
      <div className="grid2">
        <section className="card"><h2>Last six months</h2><Chart data={d.chart} />
          <p className="legend"><i className="k1" />Income <i className="k2" />Spent</p></section>
        <section className="card"><h2>Quick actions</h2>
          <Link className="btn primary block" to="/send">Send money</Link>
          <Link className="btn ghost block" to="/transactions">View all transactions</Link></section>
      </div>
      <section className="card"><h2>Recent activity</h2><TxTable rows={d.recent} /></section>
    </>
  );
}

export function SendMoney() {
  const { user, refresh } = useAuth();
  const [err, setErr] = useState('');
  const [fe, setFe] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; reference: string }>();
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setErr(''); setDone(undefined);
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const errs: Record<string, string> = {};
    if (!/^VP\d{10}$/i.test(f.accountNumber.trim())) errs.accountNumber = 'Use the format VP followed by 10 digits';
    const amt = Number(f.amount);
    if (!(amt > 0)) errs.amount = 'Enter an amount greater than 0';
    else if (user && amt > user.balance) errs.amount = `Amount exceeds your balance of ${usd(user.balance)}`;
    setFe(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try { setDone(await api('/transfers', { method: 'POST', body: f })); await refresh(); form.reset(); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <>
      <Head title="Send money" sub={user ? `Available: ${usd(user.balance)}` : ''} />
      <form className="card form" onSubmit={submit} noValidate>
        {done && <p className="ok banner" role="status">Payment sent. Reference {done.reference}. <Link to={`/transactions/${done.id}`}>View receipt</Link></p>}
        <Field id="accountNumber" label="Recipient account number" placeholder="VP0123456789" error={fe.accountNumber} required />
        <Field id="amount" label="Amount (USD)" type="number" step="0.01" min="0.01" inputMode="decimal" error={fe.amount} required />
        <Field id="note" label="Note (optional)" maxLength={140} />
        {err && <p className="err banner" role="alert">{err}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Sending…' : 'Send payment'}</button>
      </form>
    </>
  );
}

export function History() {
  const [rows, setRows] = useState<Tx[]>();
  const [q, setQ] = useState('');
  const [dir, setDir] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    const id = setTimeout(() => {
      api<Tx[]>(`/transactions?direction=${dir}&q=${encodeURIComponent(q)}`).then(setRows).catch((e) => setErr(e.message));
    }, 250);
    return () => clearTimeout(id);
  }, [q, dir]);
  return (
    <>
      <Head title="Transactions" sub="Every deposit and payment on your account." />
      <div className="card">
        <div className="filters">
          <input aria-label="Search transactions" placeholder="Search by name, note or reference" value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Filter by direction" value={dir} onChange={(e) => setDir(e.target.value)}>
            <option value="">All</option><option value="credit">Money in</option><option value="debit">Money out</option>
          </select>
        </div>
        {err ? <p className="err banner" role="alert">{err}</p> : rows ? <TxTable rows={rows} /> : <Skeleton h={200} />}
      </div>
    </>
  );
}

const Row = ({ k, v }: { k: string; v: ReactNode }) => <div className="row"><dt>{k}</dt><dd>{v}</dd></div>;
export function Details() {
  const { id } = useParams();
  const [t, setT] = useState<Tx>();
  const [err, setErr] = useState('');
  useEffect(() => { api<Tx>(`/transactions/${id}`).then(setT).catch((e) => setErr(e.message)); }, [id]);
  return (
    <>
      <Head title="Transaction details" />
      {err ? <p className="err banner" role="alert">{err} <Link to="/transactions">Back to transactions</Link></p> : !t ? <Skeleton h={260} /> : (
        <div className="card receipt">
          <div className="big"><Amount t={t} /></div>
          <dl>
            <Row k="Status" v={<span className="badge">{t.status}</span>} />
            <Row k="Type" v={t.type} />
            <Row k="Reference" v={t.reference} />
            <Row k="Date" v={fmtDate(t.created_at)} />
            <Row k="From" v={t.from_name ? `${t.from_name} (${t.from_number})` : 'VaultPay'} />
            <Row k="To" v={t.to_name ? `${t.to_name} (${t.to_number})` : '—'} />
            <Row k="Note" v={t.note || '—'} />
          </dl>
          <Link className="btn ghost" to="/transactions">Back to transactions</Link>
        </div>
      )}
    </>
  );
}

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  if (!user) return null;
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setMsg(''); setErr('');
    try { setUser(await api<Profile>('/profile', { method: 'PUT', body: Object.fromEntries(new FormData(e.currentTarget)) })); setMsg('Profile saved'); }
    catch (x) { setErr((x as Error).message); }
  };
  return (
    <>
      <Head title="Account profile" />
      <div className="grid2">
        <section className="card"><h2>Account</h2>
          <dl><Row k="Account number" v={user.accountNumber} /><Row k="Balance" v={usd(user.balance)} />
            <Row k="Member since" v={new Date(user.createdAt).toLocaleDateString()} /></dl>
        </section>
        <form className="card form" onSubmit={save} noValidate>
          <h2>Personal details</h2>
          <Field id="fullName" label="Full name" defaultValue={user.fullName} required />
          <Field id="email" label="Email" value={user.email} readOnly />
          <Field id="phone" label="Phone" defaultValue={user.phone || ''} autoComplete="tel" />
          {msg && <p className="ok banner" role="status">{msg}</p>}
          {err && <p className="err banner" role="alert">{err}</p>}
          <button className="btn primary">Save changes</button>
        </form>
      </div>
    </>
  );
}

export const NotFound = () => (
  <div className="center col"><h1 className="nf">404</h1><p className="muted">This page doesn’t exist or has moved.</p><Link className="btn primary" to="/">Go to home</Link></div>
);
