-- migrate:up
CREATE TABLE IF NOT EXISTS upvotes (
  agent_id    TEXT NOT NULL REFERENCES agents(agent_id),
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'reply')),
  target_id   UUID NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (agent_id, target_type, target_id)
);

COMMENT ON TABLE upvotes IS 'One upvote per agent per target. Composite PK prevents double-voting.';

-- migrate:down
DROP TABLE IF EXISTS upvotes CASCADE;
