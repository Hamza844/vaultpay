const KEY = 'vp_token';
export const token = {
  get: () => localStorage.getItem(KEY),
  set: (t: string) => localStorage.setItem(KEY, t),
  clear: () => localStorage.removeItem(KEY)
};

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const t = token.get();
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && t) token.clear();
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

export const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
export const fmtDate = (s: string) => new Date(s).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

export type Tx = {
  id: string; reference: string; type: string; amount: number; note: string | null; status: string;
  created_at: string; direction: 'credit' | 'debit';
  from_name: string | null; from_number: string | null; to_name: string | null; to_number: string | null;
};
export type Profile = {
  fullName: string; email: string; phone: string | null; createdAt: string;
  accountNumber: string; balance: number; currency: string;
};
export const counterparty = (t: Tx) =>
  t.type === 'deposit' ? 'VaultPay' : t.direction === 'credit' ? t.from_name || 'Unknown' : t.to_name || 'Unknown';
