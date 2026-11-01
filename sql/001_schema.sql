CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text NOT NULL,
  full_name text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  account_number text NOT NULL UNIQUE,
  currency char(3) NOT NULL DEFAULT 'USD',
  balance numeric(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('transfer','deposit')),
  from_account_id uuid REFERENCES accounts(id),
  to_account_id uuid REFERENCES accounts(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  note text,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_account_id IS NOT NULL OR to_account_id IS NOT NULL),
  CHECK (from_account_id IS DISTINCT FROM to_account_id)
);
CREATE INDEX IF NOT EXISTS idx_tx_from ON transactions (from_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_to ON transactions (to_account_id, created_at DESC);
