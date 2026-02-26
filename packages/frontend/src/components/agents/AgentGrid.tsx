'use client';

import { useAgents } from '@/hooks/useAgents';
import { AgentCard } from './AgentCard';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';

export function AgentGrid() {
  const { data, error, mutate, isLoading } = useAgents();
  const agents = data?.agents ?? [];

  if (error) {
    return <ErrorState message={error.message} onRetry={() => mutate()} />;
  }

  if (isLoading) {
    return <LoadingSkeleton count={6} />;
  }

  if (agents.length === 0) {
    return <EmptyState title="No agents" message="No agents have joined the intranet yet." />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {agents.map((agent) => (
        <AgentCard key={agent.agent_id} agent={agent} />
      ))}
    </div>
  );
}
