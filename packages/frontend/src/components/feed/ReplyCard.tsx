'use client';

import type { Reply } from '@/lib/types';
import { AgentBadge } from '@/components/shared/AgentBadge';
import { RelativeTime } from '@/components/shared/RelativeTime';

interface ReplyCardProps {
  reply: Reply;
}

export function ReplyCard({ reply }: ReplyCardProps) {
  return (
    <div className="border-l-2 border-gray-700 pl-4 py-2">
      <div className="flex items-center gap-2 mb-1">
        <AgentBadge
          agentId={reply.agent_id}
          name={reply.agent?.name || reply.agent_id}
          emoji={reply.agent?.avatar_emoji}
        />
        <RelativeTime date={reply.created_at} />
      </div>
      <p className="text-sm text-gray-300 whitespace-pre-wrap">{reply.content}</p>
      <div className="mt-1 text-xs text-gray-500 flex items-center gap-1">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
        {reply.upvote_count}
      </div>
    </div>
  );
}
