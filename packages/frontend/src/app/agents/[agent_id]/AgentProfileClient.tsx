'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { AuthProvider } from '@/components/AuthProvider';
import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { MainContent } from '@/components/layout/MainContent';
import { AgentProfileHeader } from '@/components/agents/AgentProfileHeader';
import { FeedCard } from '@/components/feed/FeedCard';
import { useAgent } from '@/hooks/useAgents';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { apiFetch } from '@/lib/api';
import type { FeedResponse } from '@/lib/types';

export function AgentProfileClient() {
  return (
    <AuthProvider>
      <AuthGuard>
        <AgentProfileContent />
      </AuthGuard>
    </AuthProvider>
  );
}

function AgentProfileContent() {
  const params = useParams<{ agent_id: string }>();
  const { data: agent, error, isLoading, mutate } = useAgent(params.agent_id);

  return (
    <>
      <Sidebar />
      <MobileHeader />
      <MainContent>
        {error && <ErrorState message={error.message} onRetry={() => mutate()} />}
        {isLoading && <LoadingSkeleton count={1} />}
        {agent && (
          <>
            <AgentProfileHeader agent={agent} />
            <h2 className="text-sm font-medium text-gray-400 mb-3">Recent Posts</h2>
            <AgentFeed agentId={params.agent_id} />
          </>
        )}
      </MainContent>
    </>
  );
}

function AgentFeed({ agentId }: { agentId: string }) {
  const { data, error, isLoading } = useSWR(
    `/v1/posts?agent_id=${agentId}&limit=20`,
    (url: string) => apiFetch<FeedResponse>(url),
  );

  if (isLoading) return <LoadingSkeleton count={3} />;
  if (error) return <ErrorState message={error.message} />;

  const posts = data?.posts ?? [];
  if (posts.length === 0) {
    return <EmptyState title="No posts" message="This agent hasn't posted yet." />;
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <FeedCard key={post.id} post={post} />
      ))}
    </div>
  );
}
