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
import { signUp, useSession } from '@/lib/auth-client';

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
    mockedSignUp.mockReset();
    vi.mocked(useSession).mockReturnValue({ data: null, isPending: false } as any);
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

  it('groups belt options into Adulto and Infantil with white once', async () => {
    mockedApi.mockResolvedValue(academy);
    renderEntrar();

    const adult = await screen.findByRole('group', { name: 'beltGroups.adult' });
    const kids = screen.getByRole('group', { name: 'beltGroups.kids' });
    const names = (g: HTMLElement) => Array.from(g.querySelectorAll('option')).map(o => o.value);
    expect(names(adult)).toEqual(['white', 'blue', 'purple', 'brown', 'black']);
    expect(names(kids)).toHaveLength(12);
    expect(names(kids)[0]).toBe('grey-white');
    expect(screen.getAllByRole('option', { name: 'belts.white' })).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'belts.orange-white' })).toBeInTheDocument();
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

  it('signs up without authority fields, then joins the academy server-side', async () => {
    mockedApi.mockResolvedValue(academy);
    mockedSignUp.mockResolvedValue({ error: null } as any);
    const user = userEvent.setup();
    renderEntrar();

    await user.type(await screen.findByLabelText('auth.name'), 'Ana');
    await user.type(screen.getByLabelText('auth.email'), 'a@b.com');
    await user.type(screen.getByLabelText('auth.password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'onboarding.continue' }));

    await waitFor(() => {
      expect(mockedApi).toHaveBeenCalledWith('/academies/1/join', { method: 'POST' });
    });
    const body = mockedSignUp.mock.calls[0][0] as Record<string, unknown>;
    expect(body).not.toHaveProperty('academyId');
    expect(body).not.toHaveProperty('role');
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

  it('with a session but no academy, joins with the existing account instead of signing up again', async () => {
    // A person who signed up and left before joining: logged in, no academy yet.
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: 'u1', name: 'Ana', email: 'a@b.com', academyId: null, role: 'student', status: 'active' } },
      isPending: false,
    } as any);
    mockedApi.mockImplementation(async (path: string) => (path.startsWith('/academies/by-code') ? academy : { status: 'pending' }) as any);
    const user = userEvent.setup();
    renderEntrar();

    expect(await screen.findByText('Gracie Barra')).toBeInTheDocument();
    expect(screen.getByText('onboarding.joinAs')).toBeInTheDocument();
    expect(screen.queryByLabelText('auth.email')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('auth.password')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'onboarding.joinTitle' }));

    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('/academies/1/join', { method: 'POST' }));
    expect(mockedSignUp).not.toHaveBeenCalled();
  });

  it('with a session, a failed join shows a translated alert', async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: 'u1', name: 'Ana', email: 'a@b.com', academyId: null } },
      isPending: false,
    } as any);
    mockedApi.mockImplementation(async (path: string) => {
      if (path.startsWith('/academies/by-code')) {
        return academy as any;
      }
      throw new Error('Academy not found');
    });
    const user = userEvent.setup();
    renderEntrar();

    await user.click(await screen.findByRole('button', { name: 'onboarding.joinTitle' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('onboarding.academyNotFound');
  });
});
