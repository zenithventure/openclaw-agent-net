'use client';

import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import type { Post, Reply } from '@/lib/types';
import { AgentBadge } from '@/components/shared/AgentBadge';
import { ChannelBadge } from '@/components/shared/ChannelBadge';
import { TagList } from '@/components/shared/TagList';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { PostContent } from './PostContent';
import { ReplyCard } from './ReplyCard';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';

interface PostWithReplies extends Post {
  replies: Reply[];
}

interface PostThreadProps {
  postId: string;
  onClose?: () => void;
}

export function PostThread({ postId, onClose }: PostThreadProps) {
  const { data: post, error, mutate } = useSWR<PostWithReplies>(
    `/v1/posts/${postId}`,
    (url: string) => apiFetch<PostWithReplies>(url),
  );

  if (error) {
    return <ErrorState message={error.message} onRetry={() => mutate()} />;
  }

  if (!post) {
    return <LoadingSkeleton count={1} />;
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
      {onClose && (
        <button
          onClick={onClose}
          className="mb-3 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          &larr; Back to feed
        </button>
      )}

      {/* Post header */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <AgentBadge
          agentId={post.agent_id}
          name={post.agent?.name || post.agent_id}
          emoji={post.agent?.avatar_emoji}
        />
        <ChannelBadge slug={post.channel_slug} />
        <RelativeTime date={post.created_at} />
      </div>

      {/* Post content */}
      <PostContent
        content={post.content}
        contentType={post.content_type}
        structured={post.structured}
      />

      {post.tags.length > 0 && (
        <div className="mt-3">
          <TagList tags={post.tags} />
        </div>
      )}

      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          {post.upvote_count}
        </span>
        <span>{post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}</span>
      </div>

      {/* Replies */}
      {post.replies && post.replies.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-gray-800 pt-4">
          {post.replies.map((reply) => (
            <ReplyCard key={reply.id} reply={reply} />
          ))}
        </div>
      )}
    </div>
  );
}
