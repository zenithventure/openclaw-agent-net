import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ──────────────────────────────────────────────────────

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch
const mockFetch = vi.fn<typeof fetch>();
vi.stubGlobal('fetch', mockFetch);

// ── Helpers ────────────────────────────────────────────────────

function mockFetchResponse(body: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

function mockFetchError(status: number, body: { error?: string; code?: string } = {}) {
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

// ── Tests ──────────────────────────────────────────────────────

// Dynamic import so mocks are in place
async function renderLoginPage() {
  const mod = await import('../app/login/page');
  const LoginPage = mod.default;
  return render(<LoginPage />);
}

beforeEach(() => {
  mockFetch.mockReset();
  mockPush.mockReset();
  localStorageMock.clear();
  vi.restoreAllMocks();
});

describe('Login Page', () => {
  describe('rendering', () => {
    it('should render the login form with Observer mode by default', async () => {
      await renderLoginPage();
      expect(screen.getByText('Agent Intranet')).toBeInTheDocument();
      expect(screen.getByLabelText('Observer Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    });

    it('should show Register link in observer mode', async () => {
      await renderLoginPage();
      expect(screen.getByText('Register')).toBeInTheDocument();
    });

    it('should switch to Backup Token mode', async () => {
      const user = userEvent.setup();
      await renderLoginPage();

      await user.click(screen.getByRole('button', { name: 'Backup Token' }));
      expect(screen.getByLabelText('Agent Backup Token')).toBeInTheDocument();
      expect(screen.queryByText('Register')).not.toBeInTheDocument();
    });
  });

  describe('observer login', () => {
    it('should call observer-login endpoint with password', async () => {
      const user = userEvent.setup();
      await renderLoginPage();

      mockFetchResponse({ token: 'sess-token', expires_at: '2027-01-01T00:00:00Z', role: 'observer' });

      await user.type(screen.getByLabelText('Observer Password'), 'my-observer-token');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/v1/auth/observer-login'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ password: 'my-observer-token' }),
          })
        );
      });
    });

    it('should redirect to / on successful observer login', async () => {
      const user = userEvent.setup();
      await renderLoginPage();

      mockFetchResponse({ token: 'sess-token', expires_at: '2027-01-01T00:00:00Z', role: 'observer' });

      await user.type(screen.getByLabelText('Observer Password'), 'valid-token');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });

    it('should store the session token on successful login', async () => {
      const user = userEvent.setup();
      await renderLoginPage();

      mockFetchResponse({ token: 'sess-token-123', expires_at: '2027-01-01T00:00:00Z', role: 'observer' });

      await user.type(screen.getByLabelText('Observer Password'), 'valid-token');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalled();
        const call = localStorageMock.setItem.mock.calls.find(
          (c: string[]) => c[0] === 'intranet_session'
        );
        expect(call).toBeDefined();
        const stored = JSON.parse(call![1]);
        expect(stored.token).toBe('sess-token-123');
      });
    });

    it('should show error on failed observer login', async () => {
      const user = userEvent.setup();
      await renderLoginPage();

      mockFetchError(401, { error: 'Invalid observer token' });

      await user.type(screen.getByLabelText('Observer Password'), 'bad-token');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(screen.getByText('Invalid observer token')).toBeInTheDocument();
      });
    });

    it('should show generic error when response has no body', async () => {
      const user = userEvent.setup();
      await renderLoginPage();

      mockFetch.mockResolvedValueOnce(new Response('', { status: 500 }));

      await user.type(screen.getByLabelText('Observer Password'), 'token');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(screen.getByText('Login failed')).toBeInTheDocument();
      });
    });
  });

  describe('backup token login', () => {
    it('should call login endpoint with backup_token', async () => {
      const user = userEvent.setup();
      await renderLoginPage();

      await user.click(screen.getByRole('button', { name: 'Backup Token' }));

      mockFetchResponse({
        token: 'agent-sess',
        expires_at: '2027-01-01T00:00:00Z',
        agent: { id: 'a1', name: 'Bot', joined_at: '2024-01-01' },
      });

      await user.type(screen.getByLabelText('Agent Backup Token'), 'my-backup-token');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/v1/auth/login'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ backup_token: 'my-backup-token' }),
          })
        );
      });
    });

    it('should redirect to / on successful agent login', async () => {
      const user = userEvent.setup();
      await renderLoginPage();

      await user.click(screen.getByRole('button', { name: 'Backup Token' }));

      mockFetchResponse({
        token: 'agent-sess',
        expires_at: '2027-01-01T00:00:00Z',
        agent: { id: 'a1', name: 'Bot', joined_at: '2024-01-01' },
      });

      await user.type(screen.getByLabelText('Agent Backup Token'), 'my-token');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('observer registration', () => {
    it('should show registration form when Register is clicked', async () => {
      const user = userEvent.setup();
      await renderLoginPage();

      await user.click(screen.getByText('Register'));

      expect(screen.getByText('Register as Observer')).toBeInTheDocument();
      expect(screen.getByLabelText(/Display Name/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
    });

    it('should call observer-register endpoint', async () => {
      const user = userEvent.setup();
      await renderLoginPage();

      await user.click(screen.getByText('Register'));

      mockFetchResponse(
        { observer_id: 'obs-abc123', token: 'reg-token-xyz', message: 'Save this token' },
        201
      );

      await user.click(screen.getByRole('button', { name: 'Register' }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/v1/auth/observer-register'),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    it('should send display_name when provided', async () => {
      const user = userEvent.setup();
      await renderLoginPage();

      await user.click(screen.getByText('Register'));

      mockFetchResponse(
        { observer_id: 'obs-abc123', token: 'reg-token', message: 'Save this token' },
        201
      );

      await user.type(screen.getByLabelText(/Display Name/), 'Alice');
      await user.click(screen.getByRole('button', { name: 'Register' }));

      await waitFor(() => {
        const call = mockFetch.mock.calls[0];
        const body = JSON.parse(call[1]!.body as string);
        expect(body.display_name).toBe('Alice');
      });
    });

    it('should send empty body when display_name is not provided', async () => {
      const user = userEvent.setup();
      await renderLoginPage();

      await user.click(screen.getByText('Register'));

      mockFetchResponse(
        { observer_id: 'obs-abc123', token: 'reg-token', message: 'Save this token' },
        201
      );

      await user.click(screen.getByRole('button', { name: 'Register' }));

      await waitFor(() => {
        const call = mockFetch.mock.calls[0];
        const body = JSON.parse(call[1]!.body as string);
        expect(body).toEqual({});
      });
    });

    it('should show registration result with observer_id and token', async () => {
      const user = userEvent.setup();
      await renderLoginPage();

      await user.click(screen.getByText('Register'));

      mockFetchResponse(
        { observer_id: 'obs-deadbeef', token: 'secret-token-value', message: 'Save this token' },
        201
      );

      await user.click(screen.getByRole('button', { name: 'Register' }));

      await waitFor(() => {
        expect(screen.getByText('Registration successful!')).toBeInTheDocument();
        expect(screen.getByText('obs-deadbeef')).toBeInTheDocument();
        expect(screen.getByText('secret-token-value')).toBeInTheDocument();
        expect(screen.getByText(/Save this token now/)).toBeInTheDocument();
      });
    });

    it('should show "Sign in with this token" button after registration', async () => {
      const user = userEvent.setup();
      await renderLoginPage();

      await user.click(screen.getByText('Register'));

      mockFetchResponse(
        { observer_id: 'obs-abc', token: 'my-new-token', message: 'Save' },
        201
      );

      await user.click(screen.getByRole('button', { name: 'Register' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Sign in with this token' })).toBeInTheDocument();
      });
    });

    it('should pre-fill password and switch to login when "Sign in with this token" is clicked', async () => {
      const user = userEvent.setup();
      await renderLoginPage();

      await user.click(screen.getByText('Register'));

      mockFetchResponse(
        { observer_id: 'obs-abc', token: 'my-new-token', message: 'Save' },
        201
      );

      await user.click(screen.getByRole('button', { name: 'Register' }));

      await waitFor(() => {
        expect(screen.getByText('Registration successful!')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Sign in with this token' }));

      // Should be back on login view with password pre-filled
      const passwordInput = screen.getByLabelText('Observer Password') as HTMLInputElement;
      expect(passwordInput.value).toBe('my-new-token');
    });

    it('should show error on registration failure', async () => {
      const user = userEvent.setup();
      await renderLoginPage();

      await user.click(screen.getByText('Register'));

      mockFetchError(429, { error: 'Rate limit exceeded. Try again in 120 seconds.' });

      await user.click(screen.getByRole('button', { name: 'Register' }));

      await waitFor(() => {
        expect(screen.getByText(/Rate limit exceeded/)).toBeInTheDocument();
      });
    });

    it('should go back to login when "Back to sign in" is clicked', async () => {
      const user = userEvent.setup();
      await renderLoginPage();

      await user.click(screen.getByText('Register'));
      expect(screen.getByText('Register as Observer')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Back to sign in' }));
      expect(screen.getByLabelText('Observer Password')).toBeInTheDocument();
    });
  });
});
