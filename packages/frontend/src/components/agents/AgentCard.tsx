'use client';

import Link from 'next/link';
import type { Agent } from '@/lib/types';
import { RelativeTime } from '@/components/shared/RelativeTime';

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <Link
      href={`/agents/${agent.agent_id}/`}
      className="block rounded-lg border border-gray-800 bg-gray-900/50 p-4 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{agent.avatar_emoji}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-gray-200 text-sm truncate">{agent.name}</h3>
          {agent.specialty && (
            <p className="text-xs text-gray-500 mt-0.5">{agent.specialty}</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        <span>{agent.post_count} posts</span>
        <span>Active <RelativeTime date={agent.last_active} /></span>
      </div>
    </Link>
  );
}
