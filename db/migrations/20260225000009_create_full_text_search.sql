-- migrate:up

-- Add a tsvector column to posts for full-text search
ALTER TABLE posts ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- GIN index on the tsvector column
CREATE INDEX IF NOT EXISTS idx_posts_search ON posts USING GIN(search_vector);

-- Function to generate the tsvector from content and tags
CREATE OR REPLACE FUNCTION posts_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: auto-update search_vector on INSERT or UPDATE of content/tags
CREATE OR REPLACE TRIGGER trg_posts_search_vector
  BEFORE INSERT OR UPDATE OF content, tags ON posts
  FOR EACH ROW
  EXECUTE FUNCTION posts_search_vector_update();

-- Backfill existing rows (safe to run on empty table, handles future re-runs)
UPDATE posts SET search_vector =
  setweight(to_tsvector('english', COALESCE(content, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(tags, ' '), '')), 'B');

-- ============================================================
-- Search function: returns posts matching a query with ranking
-- ============================================================

CREATE OR REPLACE FUNCTION search_posts(
  search_query TEXT,
  channel_filter TEXT DEFAULT NULL,
  result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  post_id       UUID,
  agent_id      TEXT,
  channel_slug  TEXT,
  content       TEXT,
  content_type  TEXT,
  tags          TEXT[],
  upvote_count  INTEGER,
  reply_count   INTEGER,
  created_at    TIMESTAMPTZ,
  rank          REAL,
  headline      TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS post_id,
    p.agent_id,
    p.channel_slug,
    p.content,
    p.content_type,
    p.tags,
    p.upvote_count,
    p.reply_count,
    p.created_at,
    ts_rank(p.search_vector, websearch_to_tsquery('english', search_query)) AS rank,
    ts_headline('english', p.content, websearch_to_tsquery('english', search_query),
      'StartSel=**, StopSel=**, MaxWords=40, MinWords=20') AS headline
  FROM posts p
  WHERE
    p.is_deleted = false
    AND p.search_vector @@ websearch_to_tsquery('english', search_query)
    AND (channel_filter IS NULL OR p.channel_slug = channel_filter)
  ORDER BY rank DESC, p.created_at DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_posts IS 'Full-text search across posts. Uses websearch_to_tsquery for natural language queries. Results ranked by relevance then recency.';

-- migrate:down
DROP FUNCTION IF EXISTS search_posts(TEXT, TEXT, INTEGER);
DROP TRIGGER IF EXISTS trg_posts_search_vector ON posts;
DROP FUNCTION IF EXISTS posts_search_vector_update();
DROP INDEX IF EXISTS idx_posts_search;
ALTER TABLE posts DROP COLUMN IF EXISTS search_vector;
