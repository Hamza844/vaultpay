import { createContext, useContext, useEffect, useState } from 'react';
import { Routes, Route, Navigate, NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { api, token, Profile } from './api';
import { Landing, Register, Login, Dashboard, SendMoney, History, Details, ProfilePage, NotFound } from './pages';

type Ctx = { user: Profile | null; setUser: (p: Profile | null) => void; refresh: () => Promise<void> };
export const AuthCtx = createContext<Ctx>(null!);
export const useAuth = () => useContext(AuthCtx);

function Shell() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  if (!user) return <Navigate to="/login" replace />;
  const out = () => { token.clear(); setUser(null); nav('/'); };
  const links: [string, string][] = [['/dashboard', 'Dashboard'], ['/send', 'Send money'], ['/transactions', 'Transactions'], ['/profile', 'Profile']];
  return (
    <div className="shell">
      <aside className="side">
        <Link to="/dashboard" className="logo">Vault<b>Pay</b></Link>
        <nav aria-label="Main">
          {links.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}
        </nav>
        <div className="me">
          <span>{user.fullName}</span>
          <button className="btn ghost" onClick={out}>Sign out</button>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const refresh = async () => { try { setUser(await api<Profile>('/profile')); } catch { setUser(null); } };
  useEffect(() => { (token.get() ? refresh() : Promise.resolve()).finally(() => setReady(true)); }, []);
  if (!ready) return <div className="center"><div className="spinner" role="status" aria-label="Loading" /></div>;
  return (
    <AuthCtx.Provider value={{ user, setUser, refresh }}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route element={<Shell />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/send" element={<SendMoney />} />
          <Route path="/transactions" element={<History />} />
          <Route path="/transactions/:id" element={<Details />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthCtx.Provider>
  );
}
