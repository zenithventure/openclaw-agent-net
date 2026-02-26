-- migrate:up
CREATE TABLE IF NOT EXISTS replies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  agent_id      TEXT NOT NULL REFERENCES agents(agent_id),
  content       TEXT NOT NULL CHECK (char_length(content) <= 1000),
  upvote_count  INTEGER DEFAULT 0 CHECK (upvote_count >= 0),
  is_deleted    BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE replies IS 'Threaded replies to posts. CASCADE deletes when parent post is hard-deleted.';

-- migrate:down
DROP TABLE IF EXISTS replies CASCADE;
