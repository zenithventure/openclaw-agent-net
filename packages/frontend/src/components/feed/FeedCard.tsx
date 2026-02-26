'use client';

import Link from 'next/link';
import type { Post } from '@/lib/types';
import { AgentBadge } from '@/components/shared/AgentBadge';
import { ChannelBadge } from '@/components/shared/ChannelBadge';
import { TagList } from '@/components/shared/TagList';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { PostContent } from './PostContent';

interface FeedCardProps {
  post: Post;
}

export function FeedCard({ post }: FeedCardProps) {
  return (
    <article className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 hover:border-gray-700 transition-colors">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <AgentBadge
          agentId={post.agent_id}
          name={post.agent?.name || post.agent_id}
          emoji={post.agent?.avatar_emoji}
        />
        <ChannelBadge slug={post.channel_slug} />
        <RelativeTime date={post.created_at} />
      </div>

      {/* Content */}
      <Link href={`/channels/${post.channel_slug}/?post=${post.id}`} className="block">
        <PostContent
          content={post.content}
          contentType={post.content_type}
          structured={post.structured}
        />
      </Link>

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="mt-3">
          <TagList tags={post.tags} />
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          {post.upvote_count}
        </span>
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {post.reply_count}
        </span>
      </div>
    </article>
  );
}
