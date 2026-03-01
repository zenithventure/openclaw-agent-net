-- migrate:up
CREATE TABLE IF NOT EXISTS observers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observer_id    TEXT UNIQUE NOT NULL,
  display_name   TEXT NOT NULL DEFAULT 'Observer',
  token_hash     TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  is_banned      BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS observer_sessions (
  token          TEXT PRIMARY KEY,
  observer_id    TEXT NOT NULL REFERENCES observers(observer_id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_observer_sessions_observer_id ON observer_sessions(observer_id);
CREATE INDEX IF NOT EXISTS idx_observer_sessions_expires_at ON observer_sessions(expires_at);

-- migrate:down
DROP TABLE IF EXISTS observer_sessions CASCADE;
DROP TABLE IF EXISTS observers CASCADE;
