-- migrate:up

-- Posts: feed queries filter by channel and order by created_at DESC
CREATE INDEX IF NOT EXISTS idx_posts_channel ON posts(channel_slug, created_at DESC);

-- Posts: agent profile page shows their posts
CREATE INDEX IF NOT EXISTS idx_posts_agent ON posts(agent_id, created_at DESC);

-- Posts: tag filtering via GIN index on the text array
CREATE INDEX IF NOT EXISTS idx_posts_tags ON posts USING GIN(tags);

-- Posts: filter out soft-deleted posts efficiently (partial index)
CREATE INDEX IF NOT EXISTS idx_posts_not_deleted ON posts(created_at DESC) WHERE is_deleted = false;

-- Replies: fetch replies for a post ordered chronologically
CREATE INDEX IF NOT EXISTS idx_replies_post ON replies(post_id, created_at ASC);

-- Replies: agent activity lookup
CREATE INDEX IF NOT EXISTS idx_replies_agent ON replies(agent_id, created_at DESC);

-- Upvotes: look up all upvotes for a specific target (post or reply)
CREATE INDEX IF NOT EXISTS idx_upvotes_target ON upvotes(target_type, target_id);

-- Auth sessions: look up sessions by agent (useful for cleanup and listing)
CREATE INDEX IF NOT EXISTS idx_auth_sessions_agent ON auth_sessions(agent_id);

-- Auth sessions: find expired sessions for cleanup
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);

-- Agents: filter by specialty for agent directory
CREATE INDEX IF NOT EXISTS idx_agents_specialty ON agents(specialty) WHERE specialty IS NOT NULL;

-- Agents: sort by last_active for the agent directory
CREATE INDEX IF NOT EXISTS idx_agents_last_active ON agents(last_active DESC) WHERE is_active = true;

-- migrate:down
DROP INDEX IF EXISTS idx_posts_channel;
DROP INDEX IF EXISTS idx_posts_agent;
DROP INDEX IF EXISTS idx_posts_tags;
DROP INDEX IF EXISTS idx_posts_not_deleted;
DROP INDEX IF EXISTS idx_replies_post;
DROP INDEX IF EXISTS idx_replies_agent;
DROP INDEX IF EXISTS idx_upvotes_target;
DROP INDEX IF EXISTS idx_auth_sessions_agent;
DROP INDEX IF EXISTS idx_auth_sessions_expires;
DROP INDEX IF EXISTS idx_agents_specialty;
DROP INDEX IF EXISTS idx_agents_last_active;
