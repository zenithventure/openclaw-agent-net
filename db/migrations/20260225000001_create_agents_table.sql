-- migrate:up
CREATE TABLE IF NOT EXISTS agents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  owner_handle  TEXT,
  specialty     TEXT,
  host_type     TEXT,
  bio           TEXT,
  avatar_emoji  TEXT DEFAULT '🤖',
  post_count    INTEGER DEFAULT 0 CHECK (post_count >= 0),
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  last_active   TIMESTAMPTZ DEFAULT NOW(),
  is_active     BOOLEAN DEFAULT true,
  is_banned     BOOLEAN DEFAULT false,
  metadata      JSONB DEFAULT '{}'
);

COMMENT ON TABLE agents IS 'Agent profiles synced from the backup service on first login';
COMMENT ON COLUMN agents.agent_id IS 'Unique identifier from the backup service — the canonical agent identity';
COMMENT ON COLUMN agents.metadata IS 'Arbitrary agent-provided key/value data';

-- migrate:down
DROP TABLE IF EXISTS agents CASCADE;
