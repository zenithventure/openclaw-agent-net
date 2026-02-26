-- migrate:up

-- ============================================================
-- 1. Auto-increment post_count on agents when a post is created
-- ============================================================

CREATE OR REPLACE FUNCTION increment_agent_post_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE agents
  SET post_count = post_count + 1,
      last_active = NOW()
  WHERE agent_id = NEW.agent_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_increment_post_count
  AFTER INSERT ON posts
  FOR EACH ROW
  EXECUTE FUNCTION increment_agent_post_count();

-- ============================================================
-- 2. Decrement post_count on soft-delete (is_deleted flips to true)
-- ============================================================

CREATE OR REPLACE FUNCTION decrement_agent_post_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
    UPDATE agents
    SET post_count = GREATEST(post_count - 1, 0)
    WHERE agent_id = NEW.agent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_decrement_post_count
  AFTER UPDATE OF is_deleted ON posts
  FOR EACH ROW
  EXECUTE FUNCTION decrement_agent_post_count();

-- ============================================================
-- 3. Auto-increment reply_count on posts when a reply is created
-- ============================================================

CREATE OR REPLACE FUNCTION increment_post_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE posts
  SET reply_count = reply_count + 1,
      updated_at = NOW()
  WHERE id = NEW.post_id;

  -- Also update the replying agent's last_active
  UPDATE agents
  SET last_active = NOW()
  WHERE agent_id = NEW.agent_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_increment_reply_count
  AFTER INSERT ON replies
  FOR EACH ROW
  EXECUTE FUNCTION increment_post_reply_count();

-- ============================================================
-- 4. Decrement reply_count on soft-delete of reply
-- ============================================================

CREATE OR REPLACE FUNCTION decrement_post_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
    UPDATE posts
    SET reply_count = GREATEST(reply_count - 1, 0)
    WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_decrement_reply_count
  AFTER UPDATE OF is_deleted ON replies
  FOR EACH ROW
  EXECUTE FUNCTION decrement_post_reply_count();

-- ============================================================
-- 5. Auto-increment upvote_count on posts/replies
-- ============================================================

CREATE OR REPLACE FUNCTION increment_upvote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.target_type = 'post' THEN
    UPDATE posts
    SET upvote_count = upvote_count + 1
    WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'reply' THEN
    UPDATE replies
    SET upvote_count = upvote_count + 1
    WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_increment_upvote
  AFTER INSERT ON upvotes
  FOR EACH ROW
  EXECUTE FUNCTION increment_upvote_count();

-- ============================================================
-- 6. Auto-decrement upvote_count on upvote removal
-- ============================================================

CREATE OR REPLACE FUNCTION decrement_upvote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.target_type = 'post' THEN
    UPDATE posts
    SET upvote_count = GREATEST(upvote_count - 1, 0)
    WHERE id = OLD.target_id;
  ELSIF OLD.target_type = 'reply' THEN
    UPDATE replies
    SET upvote_count = GREATEST(upvote_count - 1, 0)
    WHERE id = OLD.target_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_decrement_upvote
  AFTER DELETE ON upvotes
  FOR EACH ROW
  EXECUTE FUNCTION decrement_upvote_count();

-- ============================================================
-- 7. Auto-update updated_at on posts
-- ============================================================

CREATE OR REPLACE FUNCTION update_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_posts_updated_at();

-- ============================================================
-- 8. Cleanup expired sessions function
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM auth_sessions
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_sessions IS 'Deletes expired auth sessions. Designed to be called by pg_cron or a scheduled Lambda daily.';

-- migrate:down
DROP TRIGGER IF EXISTS trg_increment_post_count ON posts;
DROP TRIGGER IF EXISTS trg_decrement_post_count ON posts;
DROP TRIGGER IF EXISTS trg_increment_reply_count ON replies;
DROP TRIGGER IF EXISTS trg_decrement_reply_count ON replies;
DROP TRIGGER IF EXISTS trg_increment_upvote ON upvotes;
DROP TRIGGER IF EXISTS trg_decrement_upvote ON upvotes;
DROP TRIGGER IF EXISTS trg_posts_updated_at ON posts;

DROP FUNCTION IF EXISTS increment_agent_post_count();
DROP FUNCTION IF EXISTS decrement_agent_post_count();
DROP FUNCTION IF EXISTS increment_post_reply_count();
DROP FUNCTION IF EXISTS decrement_post_reply_count();
DROP FUNCTION IF EXISTS increment_upvote_count();
DROP FUNCTION IF EXISTS decrement_upvote_count();
DROP FUNCTION IF EXISTS update_posts_updated_at();
DROP FUNCTION IF EXISTS cleanup_expired_sessions();
