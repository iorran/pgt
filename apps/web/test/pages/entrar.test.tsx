import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
import { signUp } from '@/lib/auth-client';

const mockedApi = vi.mocked(api);
const mockedSignUp = vi.mocked(signUp.email);
const academy = { id: '1', name: 'Gracie Barra', city: 'Rio' };

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

  it('shows error when academy not found, with a way back', async () => {
    mockedApi.mockRejectedValue(new Error('Academy not found'));
    renderEntrar();

    await waitFor(() => {
      expect(screen.getByText('onboarding.academyNotFound')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'common.back' })).toHaveAttribute('href', '/signup');
  });

  it('shows a generic error (not "not found") on network failure', async () => {
    mockedApi.mockRejectedValue(new TypeError('Failed to fetch'));
    renderEntrar();

    await waitFor(() => {
      expect(screen.getByText('common.genericError')).toBeInTheDocument();
    });
    expect(screen.queryByText('onboarding.academyNotFound')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'common.back' })).toHaveAttribute('href', '/signup');
  });

  it('translates belt options', async () => {
    mockedApi.mockResolvedValue(academy);
    renderEntrar();

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'belts.white' })).toBeInTheDocument();
    });
    expect(screen.getByRole('option', { name: 'belts.black' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'White' })).not.toBeInTheDocument();
  });

  it('requires 8+ char password with hint and autocomplete hints', async () => {
    mockedApi.mockResolvedValue(academy);
    renderEntrar();

    const password = await screen.findByLabelText('auth.password');
    expect(password).toHaveAttribute('minlength', '8');
    expect(password).toHaveAttribute('autocomplete', 'new-password');
    expect(password).toHaveAccessibleDescription('auth.passwordHint');
    expect(screen.getByLabelText('auth.email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('auth.email')).toHaveAttribute('inputmode', 'email');
    expect(screen.getByLabelText('auth.name')).toHaveAttribute('autocomplete', 'name');
  });

  it('links back to signup and to login from the form', async () => {
    mockedApi.mockResolvedValue(academy);
    renderEntrar();

    expect(await screen.findByRole('link', { name: 'common.back' })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: 'auth.haveAccount' })).toHaveAttribute('href', '/login');
  });

  it('shows a translated alert when signup fails', async () => {
    mockedApi.mockResolvedValue(academy);
    mockedSignUp.mockResolvedValue({ error: { message: 'User already exists' } } as any);
    const user = userEvent.setup();
    renderEntrar();

    await user.type(await screen.findByLabelText('auth.name'), 'Ana');
    await user.type(screen.getByLabelText('auth.email'), 'a@b.com');
    await user.type(screen.getByLabelText('auth.password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'onboarding.continue' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('common.genericError');
    expect(screen.queryByText('User already exists')).not.toBeInTheDocument();
  });
});
