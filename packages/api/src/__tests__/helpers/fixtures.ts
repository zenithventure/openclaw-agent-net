export const TEST_AGENT_ID = 'agent-test-001';
export const TEST_TOKEN = 'test-session-token-abc123';
export const ADMIN_TOKEN = 'test-admin-secret';
export const TEST_POST_ID = '550e8400-e29b-41d4-a716-446655440000';
export const TEST_REPLY_ID = '660e8400-e29b-41d4-a716-446655440001';
export const TEST_CHANNEL = 'general';
export const TEST_OBSERVER_ID = 'obs-deadbeef01234567';
export const TEST_OBSERVER_TOKEN = 'test-observer-session-token-xyz789';

export function makeAgent(overrides: Record<string, unknown> = {}) {
  return {
    agent_id: TEST_AGENT_ID,
    name: 'TestBot',
    specialty: 'testing',
    host_type: 'cloud',
    bio: 'A test agent',
    avatar_emoji: '🤖',
    post_count: 5,
    joined_at: '2024-01-01T00:00:00.000Z',
    last_active: '2024-06-01T00:00:00.000Z',
    metadata: '{"key":"value"}',
    is_active: true,
    is_banned: false,
    ...overrides,
  };
}

export function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_POST_ID,
    agent_id: TEST_AGENT_ID,
    channel_slug: TEST_CHANNEL,
    content: 'Hello world',
    content_type: 'text',
    structured: null,
    tags: '{discussion}',
    upvote_count: 3,
    reply_count: 1,
    created_at: '2024-06-01T12:00:00.000Z',
    is_deleted: false,
    ...overrides,
  };
}

export function makeReply(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_REPLY_ID,
    post_id: TEST_POST_ID,
    agent_id: TEST_AGENT_ID,
    content: 'Nice post!',
    upvote_count: 1,
    created_at: '2024-06-01T13:00:00.000Z',
    is_deleted: false,
    ...overrides,
  };
}

export function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    agent_id: TEST_AGENT_ID,
    expires_at: new Date(Date.now() + 86400000).toISOString(), // +24h
    ...overrides,
  };
}

export function makeChannel(overrides: Record<string, unknown> = {}) {
  return {
    slug: TEST_CHANNEL,
    name: 'General',
    description: 'General discussion',
    emoji: '💬',
    is_public: true,
    ...overrides,
  };
}

export function makeObserver(overrides: Record<string, unknown> = {}) {
  return {
    observer_id: TEST_OBSERVER_ID,
    display_name: 'Observer',
    is_banned: false,
    ...overrides,
  };
}

export function makeObserverSession(overrides: Record<string, unknown> = {}) {
  return {
    observer_id: TEST_OBSERVER_ID,
    expires_at: new Date(Date.now() + 86400000).toISOString(), // +24h
    ...overrides,
  };
}
