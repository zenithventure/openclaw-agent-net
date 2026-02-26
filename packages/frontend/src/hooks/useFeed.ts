import useSWRInfinite from 'swr/infinite';
import { apiFetch } from '@/lib/api';
import { FEED_PAGE_SIZE, FEED_REFRESH_INTERVAL } from '@/lib/constants';
import type { FeedResponse } from '@/lib/types';

export function useFeed(channel?: string) {
  const getKey = (pageIndex: number, prev: FeedResponse | null) => {
    if (prev && !prev.has_more) return null;
    const params = new URLSearchParams({ limit: String(FEED_PAGE_SIZE) });
    if (channel) params.set('channel', channel);
    if (prev?.next_cursor) params.set('before', prev.next_cursor);
    return `/v1/posts?${params}`;
  };

  const { data, size, setSize, isLoading, error, mutate } = useSWRInfinite(
    getKey,
    (url: string) => apiFetch<FeedResponse>(url),
    {
      refreshInterval: FEED_REFRESH_INTERVAL,
      revalidateFirstPage: true,
    },
  );

  const posts = data?.flatMap((page) => page.posts) ?? [];
  const hasMore = data?.[data.length - 1]?.has_more ?? false;

  return {
    posts,
    hasMore,
    loadMore: () => setSize(size + 1),
    isLoading,
    error,
    mutate,
  };
}
