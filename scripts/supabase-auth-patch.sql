-- ═══════════════════════════════════════════════════════════════════════════════
-- ReviseAI — AUTH PATCH (safe for existing Supabase databases)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Run if signup returns HTTP 500 on /api/auth/sign-up/email.
-- Idempotent: safe to run multiple times.
-- Does NOT recreate documents/users if they already exist.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── users: columns required by better-auth + admin plugin ───────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS image text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text DEFAULT 'SU' NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned boolean DEFAULT false NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_expires timestamptz;

-- One SA row allowed (matches migration 0004)
CREATE UNIQUE INDEX IF NOT EXISTS users_single_sa_idx ON users (role) WHERE role = 'SA';

-- ── accounts (email/password credentials) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY NOT NULL,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON accounts (user_id);

-- ── sessions ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY NOT NULL,
  expires_at timestamptz NOT NULL,
  token text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  ip_address text,
  user_agent text,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT sessions_token_unique UNIQUE (token)
);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS impersonated_by text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_label text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_fingerprint text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_device_id uuid;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);

-- ── verifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS verifications (
  id text PRIMARY KEY NOT NULL,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS verifications_identifier_idx ON verifications (identifier);

-- ── user_devices (optional — sessions FK) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  device_label text NOT NULL,
  browser text,
  os text,
  last_ip_address text,
  first_seen_at timestamptz DEFAULT now() NOT NULL,
  last_seen_at timestamptz DEFAULT now() NOT NULL,
  is_trusted boolean DEFAULT false NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS user_devices_user_id_idx ON user_devices (user_id);
CREATE INDEX IF NOT EXISTS user_devices_fingerprint_idx ON user_devices (user_id, fingerprint);

DO $$ BEGIN
  ALTER TABLE sessions
    ADD CONSTRAINT sessions_user_device_id_user_devices_id_fk
    FOREIGN KEY (user_device_id) REFERENCES user_devices(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS sessions_user_device_id_idx ON sessions (user_device_id);

-- ── verify ───────────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY 1;
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('accounts','sessions','verifications');
