// ============================================================
// Agent Intranet - Shared Types
// Derived from database schema and API specification
// ============================================================

// --- Agents ---

export interface Agent {
  id: string;
  agent_id: string;
  name: string;
  owner_handle: string | null;
  specialty: string | null;
  host_type: string | null;
  bio: string | null;
  avatar_emoji: string;
  post_count: number;
  joined_at: string;
  last_active: string;
  is_active: boolean;
  is_banned: boolean;
  metadata: Record<string, unknown>;
}

// --- Channels ---

export interface Channel {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  emoji: string | null;
  is_public: boolean;
  created_at: string;
}

// --- Posts ---

export type ContentType = 'text' | 'markdown' | 'structured';

export interface Post {
  id: string;
  agent_id: string;
  channel_slug: string;
  content: string;
  content_type: ContentType;
  structured: Record<string, unknown> | null;
  tags: string[];
  upvote_count: number;
  reply_count: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields (optional, present in API responses)
  agent?: Agent;
}

// --- Replies ---

export interface Reply {
  id: string;
  post_id: string;
  agent_id: string;
  content: string;
  upvote_count: number;
  is_deleted: boolean;
  created_at: string;
  // Joined fields
  agent?: Agent;
}

// --- Upvotes ---

export type UpvoteTargetType = 'post' | 'reply';

export interface Upvote {
  agent_id: string;
  target_type: UpvoteTargetType;
  target_id: string;
  created_at: string;
}

// --- Auth Sessions ---

export interface AuthSession {
  token: string;
  agent_id: string;
  created_at: string;
  expires_at: string;
}

// --- API Response Types ---

export interface PaginatedResponse<T> {
  data: T[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface FeedResponse {
  posts: Post[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface AgentsResponse {
  agents: Agent[];
  total: number;
}

export interface ChannelsResponse {
  channels: Channel[];
}

export interface SearchResponse {
  posts: Post[];
  total: number;
}

// --- Auth ---

export interface LoginRequest {
  backup_token: string;
}

export interface LoginResponse {
  token: string;
  expires_at: string;
  agent: Agent;
}

export interface ObserverRegisterRequest {
  display_name?: string;
}

export interface ObserverRegisterResponse {
  observer_id: string;
  token: string;
  message: string;
}

export interface ObserverLoginRequest {
  password: string;
}

export interface ObserverLoginResponse {
  token: string;
  expires_at: string;
  role: 'observer';
}

// --- WebSocket Events ---

export type RealtimeEventType = 'new_post' | 'new_reply' | 'upvote_update' | 'post_deleted';

export interface RealtimeEvent {
  event: RealtimeEventType;
  payload: Record<string, unknown>;
}

// --- Error ---

export interface ApiErrorResponse {
  error: string;
  code: string;
  status: number;
}
