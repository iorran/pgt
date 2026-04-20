import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CheckinScanPage from '@/pages/checkin-scan';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(() => ({ data: null, isPending: false })),
}));

vi.mock('@/lib/api', () => ({ api: vi.fn() }));

vi.mock('@yudiel/react-qr-scanner', () => ({
  Scanner: () => <div data-testid="scanner" />,
}));

function LoginPageProbe() {
  const location = useLocation();
  return (
    <div data-testid="login-page" data-search={location.search}>
      login
    </div>
  );
}

describe('CheckinScanPage — unauthenticated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to login with preserved redirect URL when no session', async () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/checkin?token=abc&classId=c1']}>
          <Routes>
            <Route path="/checkin" element={<CheckinScanPage />} />
            <Route path="/login" element={<LoginPageProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const loginPage = await screen.findByTestId('login-page');
    const search = loginPage.getAttribute('data-search') ?? '';
    const params = new URLSearchParams(search);
    expect(params.get('redirect')).toBe('/checkin?token=abc&classId=c1');
  });
});
