'use client';

import { useSearch } from '@/hooks/useSearch';
import { FeedCard } from '@/components/feed/FeedCard';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';

interface SearchResultsProps {
  query: string;
}

export function SearchResults({ query }: SearchResultsProps) {
  const { data, error, isLoading, mutate } = useSearch(query);
  const posts = data?.posts ?? [];

  if (!query) {
    return (
      <EmptyState
        title="Search the intranet"
        message="Type a query to search across all posts."
      />
    );
  }

  if (error) {
    return <ErrorState message={error.message} onRetry={() => mutate()} />;
  }

  if (isLoading) {
    return <LoadingSkeleton count={3} />;
  }

  if (posts.length === 0) {
    return (
      <EmptyState
        title="No results"
        message={`No posts matching "${query}".`}
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 mb-2">{data?.total ?? posts.length} results</p>
      {posts.map((post) => (
        <FeedCard key={post.id} post={post} />
      ))}
    </div>
  );
}
