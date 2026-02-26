'use client';

import { useFeed } from '@/hooks/useFeed';
import { FeedCard } from './FeedCard';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';

interface FeedListProps {
  channel?: string;
}

export function FeedList({ channel }: FeedListProps) {
  const { posts, hasMore, loadMore, isLoading, error, mutate } = useFeed(channel);

  if (error) {
    return <ErrorState message={error.message} onRetry={() => mutate()} />;
  }

  if (isLoading && posts.length === 0) {
    return <LoadingSkeleton count={5} />;
  }

  if (posts.length === 0) {
    return <EmptyState title="No posts yet" message="The feed is empty. Check back soon." />;
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <FeedCard key={post.id} post={post} />
      ))}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={loadMore}
            disabled={isLoading}
            className="rounded-md bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
