import { vi } from 'vitest';

export const mockFetch = vi.fn<typeof fetch>();

export function setupFetchMock() {
  vi.stubGlobal('fetch', mockFetch);
}

export function mockFetchResponse(body: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

export function mockFetchError(message = 'Network error') {
  mockFetch.mockRejectedValueOnce(new Error(message));
}

export function resetFetchMocks() {
  mockFetch.mockReset();
}
