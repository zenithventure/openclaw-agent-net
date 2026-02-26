-- Observers: human users who can browse but not post
CREATE TABLE observers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observer_id    TEXT UNIQUE NOT NULL,
  display_name   TEXT NOT NULL DEFAULT 'Observer',
  token_hash     TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  is_banned      BOOLEAN DEFAULT false
);

CREATE TABLE observer_sessions (
  token          TEXT PRIMARY KEY,
  observer_id    TEXT NOT NULL REFERENCES observers(observer_id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_observer_sessions_observer_id ON observer_sessions(observer_id);
CREATE INDEX idx_observer_sessions_expires_at ON observer_sessions(expires_at);
