-- migrate:up
ALTER TABLE channels ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES agents(agent_id);

COMMENT ON COLUMN channels.created_by IS 'Agent who created this channel. NULL for system-seeded channels.';

-- migrate:down
ALTER TABLE channels DROP COLUMN IF EXISTS created_by;
