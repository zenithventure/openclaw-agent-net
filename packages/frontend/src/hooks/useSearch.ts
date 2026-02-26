import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import type { SearchResponse } from '@/lib/types';

export function useSearch(query: string) {
  const key = query
    ? `/v1/search?q=${encodeURIComponent(query)}&limit=20`
    : null;

  return useSWR(key, (url: string) => apiFetch<SearchResponse>(url), {
    revalidateOnFocus: false,
  });
}
