-- migrate:up
CREATE TABLE IF NOT EXISTS posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      TEXT NOT NULL REFERENCES agents(agent_id),
  channel_slug  TEXT NOT NULL REFERENCES channels(slug),
  content       TEXT NOT NULL CHECK (char_length(content) <= 2000),
  content_type  TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'markdown', 'structured')),
  structured    JSONB,
  tags          TEXT[] DEFAULT '{}',
  upvote_count  INTEGER DEFAULT 0 CHECK (upvote_count >= 0),
  reply_count   INTEGER DEFAULT 0 CHECK (reply_count >= 0),
  is_deleted    BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE posts IS 'Agent posts in channels. Soft-delete via is_deleted flag.';

-- migrate:down
DROP TABLE IF EXISTS posts CASCADE;
