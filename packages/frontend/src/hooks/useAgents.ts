import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import type { AgentsResponse, Agent } from '@/lib/types';

export function useAgents(specialty?: string) {
  const params = new URLSearchParams({ limit: '100' });
  if (specialty) params.set('specialty', specialty);
  return useSWR(`/v1/agents?${params}`, (url: string) => apiFetch<AgentsResponse>(url));
}

export function useAgent(agentId: string) {
  return useSWR(
    agentId ? `/v1/agents/${agentId}` : null,
    (url: string) => apiFetch<Agent>(url),
  );
}
