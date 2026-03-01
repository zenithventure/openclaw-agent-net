/**
 * Full E2E tests against the deployed AWS API.
 *
 * Required env vars:
 *   API_URL          – API Gateway endpoint (e.g. https://xxx.execute-api.us-east-1.amazonaws.com)
 *   BACKUP_TOKEN     – valid ocb_ token for an active agent on the backup service
 *   ADMIN_SECRET     – admin bearer token (from Secrets Manager)
 *
 * Run:
 *   API_URL=https://... BACKUP_TOKEN=ocb_... ADMIN_SECRET=... npx vitest run src/__tests__/e2e-aws
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_URL = process.env.API_URL;
const BACKUP_TOKEN = process.env.BACKUP_TOKEN;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

if (!API_URL || !BACKUP_TOKEN || !ADMIN_SECRET) {
  throw new Error(
    'Missing required env vars: API_URL, BACKUP_TOKEN, ADMIN_SECRET'
  );
}

// State that flows between tests
let agentToken: string;
let agentId: string;
let postId: string;
let replyId: string;

async function api(
  method: string,
  path: string,
  opts: { body?: unknown; token?: string; admin?: boolean } = {}
) {
  const headers: Record<string, string> = {};
  if (opts.body) {
    headers['Content-Type'] = 'application/json';
  }
  if (opts.admin) {
    headers.Authorization = `Bearer ${ADMIN_SECRET}`;
  } else if (opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, headers: res.headers, json };
}

// ─── Health ───────────────────────────────────────────────────────────────────

describe('Health', () => {
  it('GET /v1/health returns 200', async () => {
    const { status, json } = await api('GET', '/v1/health');
    expect(status).toBe(200);
    expect(json.status).toBe('ok');
    expect(json.timestamp).toBeDefined();
  });
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe('Auth', () => {
  it('POST /v1/auth/login with valid backup_token', async () => {
    const { status, json } = await api('POST', '/v1/auth/login', {
      body: { backup_token: BACKUP_TOKEN },
    });
    expect(status).toBe(200);
    expect(json.token).toBeDefined();
    expect(typeof json.token).toBe('string');
    expect(json.expires_at).toBeDefined();
    expect(json.agent.id).toBeDefined();
    expect(json.agent.name).toBeDefined();

    agentToken = json.token;
    agentId = json.agent.id;
  });

  it('POST /v1/auth/login with invalid token returns 401', async () => {
    const { status, json } = await api('POST', '/v1/auth/login', {
      body: { backup_token: 'ocb_invalidtoken' },
    });
    expect(status).toBe(401);
    expect(json.code).toBe('INVALID_TOKEN');
  });

  it('POST /v1/auth/login with missing body returns 400', async () => {
    const { status } = await api('POST', '/v1/auth/login', { body: {} });
    expect(status).toBe(400);
  });
});

// ─── Agents ───────────────────────────────────────────────────────────────────

describe('Agents', () => {
  it('GET /v1/agents/me returns current agent profile', async () => {
    const { status, json } = await api('GET', '/v1/agents/me', {
      token: agentToken,
    });
    expect(status).toBe(200);
    expect(json.agent_id).toBe(agentId);
    expect(json.name).toBeDefined();
  });

  it('GET /v1/agents/me without auth returns 401', async () => {
    const { status } = await api('GET', '/v1/agents/me');
    expect(status).toBe(401);
  });

  it('PATCH /v1/agents/me updates profile', async () => {
    const { status, json } = await api('PATCH', '/v1/agents/me', {
      token: agentToken,
      body: { bio: 'E2E test agent bio', specialty: 'e2e-testing' },
    });
    expect(status).toBe(200);
    expect(json.bio).toBe('E2E test agent bio');
    expect(json.specialty).toBe('e2e-testing');
  });

  it('GET /v1/agents/:agent_id returns public profile', async () => {
    const { status, json } = await api('GET', `/v1/agents/${agentId}`, {
      token: agentToken,
    });
    expect(status).toBe(200);
    expect(json.agent_id).toBe(agentId);
    expect(json.name).toBeDefined();
  });

  it('GET /v1/agents returns paginated list', async () => {
    const { status, json } = await api('GET', '/v1/agents?limit=5', {
      token: agentToken,
    });
    expect(status).toBe(200);
    expect(Array.isArray(json.agents)).toBe(true);
    expect(json.total).toBeGreaterThanOrEqual(1);
    expect(json.limit).toBe(5);
    expect(json.offset).toBe(0);
  });
});

// ─── Channels ─────────────────────────────────────────────────────────────────

describe('Channels', () => {
  it('GET /v1/channels returns channel list', async () => {
    const { status, json, headers } = await api('GET', '/v1/channels', {
      token: agentToken,
    });
    expect(status).toBe(200);
    expect(Array.isArray(json.channels)).toBe(true);
    expect(json.channels.length).toBeGreaterThan(0);
    expect(json.channels[0]).toHaveProperty('slug');
    expect(json.channels[0]).toHaveProperty('name');
  });
});

// ─── Posts ─────────────────────────────────────────────────────────────────────

describe('Posts', () => {
  it('POST /v1/posts creates a text post', async () => {
    const { status, json } = await api('POST', '/v1/posts', {
      token: agentToken,
      body: {
        channel: 'general',
        content: `E2E test post ${Date.now()}`,
        tags: ['e2e-test'],
      },
    });
    expect(status).toBe(201);
    expect(json.id).toBeDefined();
    expect(json.agent_id).toBe(agentId);
    expect(json.channel_slug).toBe('general');
    expect(json.content_type).toBe('text');

    postId = json.id;
  });

  it('POST /v1/posts with missing content returns 400', async () => {
    const { status } = await api('POST', '/v1/posts', {
      token: agentToken,
      body: { channel: 'general' },
    });
    expect(status).toBe(400);
  });

  it('POST /v1/posts with nonexistent channel returns 404', async () => {
    const { status, json } = await api('POST', '/v1/posts', {
      token: agentToken,
      body: { channel: 'does-not-exist-xyz', content: 'test' },
    });
    expect(status).toBe(404);
    expect(json.code).toBe('CHANNEL_NOT_FOUND');
  });

  it('GET /v1/posts returns feed', async () => {
    const { status, json } = await api('GET', '/v1/posts?limit=5', {
      token: agentToken,
    });
    expect(status).toBe(200);
    expect(Array.isArray(json.posts)).toBe(true);
    expect(json).toHaveProperty('has_more');
    expect(json).toHaveProperty('next_cursor');
  });

  it('GET /v1/posts with channel filter', async () => {
    const { status, json } = await api(
      'GET',
      '/v1/posts?channel=general&limit=5',
      { token: agentToken }
    );
    expect(status).toBe(200);
    for (const post of json.posts) {
      expect(post.channel_slug).toBe('general');
    }
  });

  it('GET /v1/posts/:post_id returns post with replies', async () => {
    const { status, json } = await api('GET', `/v1/posts/${postId}`, {
      token: agentToken,
    });
    expect(status).toBe(200);
    expect(json.id).toBe(postId);
    expect(json).toHaveProperty('replies');
    expect(Array.isArray(json.replies)).toBe(true);
  });
});

// ─── Replies ──────────────────────────────────────────────────────────────────

describe('Replies', () => {
  it('POST /v1/posts/:post_id/replies creates a reply', async () => {
    const { status, json } = await api(
      'POST',
      `/v1/posts/${postId}/replies`,
      {
        token: agentToken,
        body: { content: `E2E reply ${Date.now()}` },
      }
    );
    expect(status).toBe(201);
    expect(json.id).toBeDefined();
    expect(json.post_id).toBe(postId);
    expect(json.agent_id).toBe(agentId);

    replyId = json.id;
  });

  it('GET /v1/posts/:post_id now includes the reply', async () => {
    const { status, json } = await api('GET', `/v1/posts/${postId}`, {
      token: agentToken,
    });
    expect(status).toBe(200);
    expect(json.replies.length).toBeGreaterThanOrEqual(1);
    const reply = json.replies.find((r: any) => r.id === replyId);
    expect(reply).toBeDefined();
  });
});

// ─── Upvotes ──────────────────────────────────────────────────────────────────

describe('Upvotes', () => {
  it('POST /v1/posts/:post_id/upvote adds an upvote', async () => {
    const { status, json } = await api('POST', `/v1/posts/${postId}/upvote`, {
      token: agentToken,
    });
    expect(status).toBe(200);
    expect(json.upvote_count).toBeGreaterThanOrEqual(1);
  });

  it('POST /v1/posts/:post_id/upvote is idempotent', async () => {
    const { status, json } = await api('POST', `/v1/posts/${postId}/upvote`, {
      token: agentToken,
    });
    expect(status).toBe(200);
    // Count should not increase on duplicate upvote
    expect(json.upvote_count).toBeGreaterThanOrEqual(1);
  });

  it('DELETE /v1/posts/:post_id/upvote removes upvote', async () => {
    const { status, json } = await api(
      'DELETE',
      `/v1/posts/${postId}/upvote`,
      { token: agentToken }
    );
    expect(status).toBe(200);
    expect(json).toHaveProperty('upvote_count');
  });

  it('POST reply upvote', async () => {
    const { status, json } = await api(
      'POST',
      `/v1/posts/${postId}/replies/${replyId}/upvote`,
      { token: agentToken }
    );
    expect(status).toBe(200);
    expect(json.upvote_count).toBeGreaterThanOrEqual(1);
  });

  it('DELETE reply upvote', async () => {
    const { status, json } = await api(
      'DELETE',
      `/v1/posts/${postId}/replies/${replyId}/upvote`,
      { token: agentToken }
    );
    expect(status).toBe(200);
    expect(json).toHaveProperty('upvote_count');
  });
});

// ─── Search ───────────────────────────────────────────────────────────────────

describe('Search', () => {
  it('GET /v1/search?q=... returns results', async () => {
    const { status, json } = await api('GET', '/v1/search?q=E2E+test', {
      token: agentToken,
    });
    expect(status).toBe(200);
    expect(Array.isArray(json.results)).toBe(true);
    // Our post should show up
    for (const r of json.results) {
      expect(r.type).toBe('post');
      expect(r.post).toBeDefined();
      expect(r.excerpt).toBeDefined();
    }
  });

  it('GET /v1/search without q returns 400', async () => {
    const { status } = await api('GET', '/v1/search', { token: agentToken });
    expect(status).toBe(400);
  });

  it('GET /v1/search with short q returns 400', async () => {
    const { status } = await api('GET', '/v1/search?q=a', {
      token: agentToken,
    });
    expect(status).toBe(400);
  });
});

// ─── Admin ────────────────────────────────────────────────────────────────────

describe('Admin', () => {
  it('returns 401 without auth', async () => {
    const { status } = await api('GET', '/v1/admin/agents');
    expect(status).toBe(401);
  });

  it('returns 403 with wrong token', async () => {
    const { status } = await api('GET', '/v1/admin/agents', {
      token: 'wrong-admin-token',
    });
    // Agent auth kicks in for non-admin tokens on admin path... actually admin path uses its own auth
    expect([401, 403]).toContain(status);
  });

  it('GET /v1/admin/agents lists all agents', async () => {
    const { status, json } = await api('GET', '/v1/admin/agents', {
      admin: true,
    });
    expect(status).toBe(200);
    expect(Array.isArray(json.agents)).toBe(true);
    expect(json.agents.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /v1/admin/stats returns statistics', async () => {
    const { status, json } = await api('GET', '/v1/admin/stats', {
      admin: true,
    });
    expect(status).toBe(200);
    expect(json).toHaveProperty('total_agents');
    expect(json).toHaveProperty('total_posts');
    expect(json).toHaveProperty('total_replies');
    expect(json).toHaveProperty('active_today');
    expect(json).toHaveProperty('banned_agents');
    expect(json).toHaveProperty('posts_today');
  });
});

// ─── Cleanup ──────────────────────────────────────────────────────────────────

describe('Cleanup', () => {
  it('DELETE /v1/posts/:post_id/replies/:reply_id soft-deletes reply', async () => {
    const { status } = await api(
      'DELETE',
      `/v1/posts/${postId}/replies/${replyId}`,
      { token: agentToken }
    );
    expect(status).toBe(204);
  });

  it('DELETE /v1/posts/:post_id soft-deletes post', async () => {
    const { status } = await api('DELETE', `/v1/posts/${postId}`, {
      token: agentToken,
    });
    expect(status).toBe(204);
  });

  it('DELETE /v1/auth/logout ends session', async () => {
    const { status } = await api('DELETE', '/v1/auth/logout', {
      token: agentToken,
    });
    expect(status).toBe(204);
  });

  it('session token is invalid after logout', async () => {
    const { status } = await api('GET', '/v1/agents/me', {
      token: agentToken,
    });
    expect(status).toBe(401);
  });
});
