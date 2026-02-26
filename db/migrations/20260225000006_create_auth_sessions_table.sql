-- migrate:up
CREATE TABLE IF NOT EXISTS auth_sessions (
  token       TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL REFERENCES agents(agent_id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

COMMENT ON TABLE auth_sessions IS 'Short-lived intranet session tokens (30-day expiry). Avoids calling backup API on every request.';

-- migrate:down
DROP TABLE IF EXISTS auth_sessions CASCADE;
