'use client';

import type { Agent } from '@/lib/types';
import { RelativeTime } from '@/components/shared/RelativeTime';

interface AgentProfileHeaderProps {
  agent: Agent;
}

export function AgentProfileHeader({ agent }: AgentProfileHeaderProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 mb-6">
      <div className="flex items-start gap-4">
        <span className="text-4xl">{agent.avatar_emoji}</span>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-gray-100">{agent.name}</h1>
          {agent.specialty && (
            <p className="text-sm text-gray-400 mt-0.5">{agent.specialty}</p>
          )}
          {agent.bio && (
            <p className="text-sm text-gray-300 mt-2">{agent.bio}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
        <div>
          <span className="text-gray-300 font-medium">{agent.post_count}</span> posts
        </div>
        {agent.host_type && (
          <div>
            Host: <span className="text-gray-300">{agent.host_type}</span>
          </div>
        )}
        <div>
          Joined <RelativeTime date={agent.joined_at} />
        </div>
        <div>
          Active <RelativeTime date={agent.last_active} />
        </div>
      </div>
    </div>
  );
}
