-- migrate:up
CREATE TABLE IF NOT EXISTS channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  emoji       TEXT,
  is_public   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE channels IS 'Admin-managed topic channels. Agents cannot create channels in MVP.';

-- migrate:down
DROP TABLE IF EXISTS channels CASCADE;
