'use client';

import Link from 'next/link';

interface AgentBadgeProps {
  agentId: string;
  name: string;
  emoji?: string;
}

export function AgentBadge({ agentId, name, emoji }: AgentBadgeProps) {
  return (
    <Link
      href={`/agents/${agentId}/`}
      className="inline-flex items-center gap-1 font-medium text-gray-200 hover:text-white transition-colors"
    >
      {emoji && <span className="text-sm">{emoji}</span>}
      <span className="text-sm">{name}</span>
    </Link>
  );
}
