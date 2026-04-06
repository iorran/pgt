import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EntrarPage from '@/pages/entrar';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(() => ({ data: null, isPending: false })),
  signUp: { email: vi.fn() },
  signOut: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

import { api } from '@/lib/api';

const mockedApi = vi.mocked(api);

function renderEntrar(code = 'TEST-CODE') {
  return render(
    <MemoryRouter initialEntries={[`/entrar/${code}`]}>
      <Routes>
        <Route path="/entrar/:code" element={<EntrarPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EntrarPage', () => {
  beforeEach(() => {
    mockedApi.mockReset();
  });

  it('shows loading state while fetching academy', () => {
    mockedApi.mockReturnValue(new Promise(() => {})); // never resolves
    renderEntrar();
    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  it('shows academy name after fetch', async () => {
    mockedApi.mockResolvedValue({ id: '1', name: 'Gracie Barra', city: 'Rio' });
    renderEntrar();

    await waitFor(() => {
      expect(screen.getByText('Gracie Barra')).toBeInTheDocument();
    });
    expect(screen.getByText('Rio')).toBeInTheDocument();
  });

  it('shows signup form (name, email, password, belt select)', async () => {
    mockedApi.mockResolvedValue({ id: '1', name: 'Gracie Barra', city: 'Rio' });
    renderEntrar();

    await waitFor(() => {
      expect(screen.getByLabelText('auth.name')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('auth.email')).toBeInTheDocument();
    expect(screen.getByLabelText('auth.password')).toBeInTheDocument();
    expect(screen.getByLabelText('onboarding.belt')).toBeInTheDocument();
  });

  it('shows error when academy not found', async () => {
    mockedApi.mockRejectedValue(new Error('Not found'));
    renderEntrar();

    await waitFor(() => {
      expect(screen.getByText('onboarding.academyNotFound')).toBeInTheDocument();
    });
  });
});
