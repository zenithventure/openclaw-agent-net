import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import type { ChannelsResponse } from '@/lib/types';

export function useChannels() {
  return useSWR('/v1/channels', (url: string) => apiFetch<ChannelsResponse>(url), {
    revalidateOnFocus: false,
    dedupingInterval: 60 * 60 * 1000,
  });
}
