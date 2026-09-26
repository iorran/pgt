import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import SettingsPage from '@/pages/settings';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';

const mockUseSession = vi.mocked(useSession);
const mockApi = vi.mocked(api);

const academy = {
  id: 'a1',
  name: 'Test Academy',
  city: 'Lisbon',
  latitude: null,
  longitude: null,
  address: null,
  joinCode: 'ABC123',
};

const instructorSession = {
  data: { user: { id: 'u1', role: 'owner', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const studentSession = {
  data: { user: { id: 'u2', name: 'Student', role: 'student', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

function mockAcademy(value: typeof academy) {
  mockApi.mockImplementation(async (path: string) => (path === '/modalities' ? [] : value) as any);
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(instructorSession);
    mockAcademy(academy);
  });

  it('shows settings title', () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText('nav.settings')).toBeInTheDocument();
  });

  it('shows location section for instructor', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('onboarding.setLocation')).toBeInTheDocument();
      expect(screen.getByText('onboarding.useMyLocation')).toBeInTheDocument();
    });
  });

  it('shows no location message when not set', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('onboarding.locationNotSet')).toBeInTheDocument();
    });
  });

  it('shows saved coordinates when location is set', async () => {
    mockAcademy({
      ...academy,
      latitude: '-23.5505',
      longitude: '-46.6333',
      address: 'Rua Augusta, 123',
    } as any);
    renderWithProviders(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Rua Augusta, 123')).toBeInTheDocument();
    });
  });

  it('does not show location section for students', async () => {
    mockUseSession.mockReturnValue(studentSession);
    renderWithProviders(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('nav.settings')).toBeInTheDocument();
    });
    expect(screen.queryByText('onboarding.setLocation')).not.toBeInTheDocument();
  });

  it('renders the join code for instructors', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('ABC123')).toBeInTheDocument();
    });
  });

  it('copy button writes join code to clipboard', async () => {
    // userEvent.setup() installs its own Clipboard on navigator; spy after setup
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    renderWithProviders(<SettingsPage />);

    const btn = await screen.findByRole('button', { name: 'onboarding.copyCode' });
    await user.click(btn);

    expect(writeText).toHaveBeenCalledWith('ABC123');
    writeText.mockRestore();
  });

  it('WhatsApp share opens a wa.me link with the join URL', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);

    const btn = await screen.findByRole('button', { name: 'onboarding.shareWhatsApp' });
    await user.click(btn);

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/wa\.me\/\?text=.*ABC123/),
      '_blank',
    );
    openSpy.mockRestore();
  });

  it('announces the copied state politely', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderWithProviders(<SettingsPage />);
    await user.click(await screen.findByRole('button', { name: 'onboarding.copyCode' }));
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('onboarding.copied');
    writeText.mockRestore();
  });
});

describe('SettingsPage — Modalidades', () => {
  const modalities = [
    { id: 'm1', name: 'Jiu-Jitsu', studentCount: 12 },
    { id: 'm2', name: 'MMA', studentCount: 0 },
  ];
  let postError: Error | null;
  let deleteError: Error | null;

  beforeEach(() => {
    vi.clearAllMocks();
    postError = null;
    deleteError = null;
    mockUseSession.mockReturnValue(instructorSession);
    mockApi.mockImplementation(async (path: string, options?: RequestInit) => {
      const method = options?.method ?? 'GET';
      if (path === '/academies/mine') {
        return academy as any;
      }
      if (path === '/modalities' && method === 'GET') {
        return modalities as any;
      }
      if (path === '/modalities' && method === 'POST') {
        if (postError) {
          throw postError;
        }
        return { id: 'm3', name: 'Kids', studentCount: 0 } as any;
      }
      if (method === 'DELETE' && deleteError) {
        throw deleteError;
      }
      return undefined as any;
    });
  });

  it('lists modalities with their student count', async () => {
    renderWithProviders(<SettingsPage />);
    expect(await screen.findByText('Jiu-Jitsu')).toBeInTheDocument();
    expect(screen.getByText('MMA')).toBeInTheDocument();
    expect(screen.getAllByText('settings.modalities.studentCount')).toHaveLength(2);
  });

  it('adds a modality and toasts success', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Jiu-Jitsu');
    await user.type(screen.getByLabelText('settings.modalities.newName'), 'Kids');
    await user.click(screen.getByRole('button', { name: 'settings.modalities.add' }));
    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith('/modalities', {
        method: 'POST',
        body: JSON.stringify({ name: 'Kids' }),
      });
      expect(toast.success).toHaveBeenCalledWith('settings.modalities.added');
    });
  });

  it('shows a translated inline error when the modality already exists', async () => {
    postError = new Error('MODALITY_EXISTS');
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Jiu-Jitsu');
    await user.type(screen.getByLabelText('settings.modalities.newName'), 'jiu-jitsu');
    await user.click(screen.getByRole('button', { name: 'settings.modalities.add' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('settings.modalities.errors.exists');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('renames a modality inline', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('MMA');
    await user.click(screen.getByRole('button', { name: 'settings.modalities.rename MMA' }));
    const input = screen.getByLabelText('settings.modalities.name');
    await user.clear(input);
    await user.type(input, 'MMA Pro');
    await user.click(screen.getByRole('button', { name: 'common.save' }));
    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith('/modalities/m2', {
        method: 'PUT',
        body: JSON.stringify({ name: 'MMA Pro' }),
      });
      expect(toast.success).toHaveBeenCalledWith('settings.modalities.saved');
    });
  });

  it('deletes an unused modality after confirming', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('MMA');
    await user.click(screen.getByRole('button', { name: 'settings.modalities.delete MMA' }));
    expect(mockApi).not.toHaveBeenCalledWith('/modalities/m2', expect.anything());
    await user.click(await screen.findByRole('button', { name: 'common.delete' }));
    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith('/modalities/m2', { method: 'DELETE' });
      expect(toast.success).toHaveBeenCalledWith('settings.modalities.deleted');
    });
  });

  it('disables delete for a modality in use and explains why', async () => {
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Jiu-Jitsu');
    expect(screen.getByRole('button', { name: 'settings.modalities.delete Jiu-Jitsu' })).toBeDisabled();
  });

  it('shows the in-use message when delete returns MODALITY_IN_USE', async () => {
    deleteError = new Error('MODALITY_IN_USE');
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('MMA');
    await user.click(screen.getByRole('button', { name: 'settings.modalities.delete MMA' }));
    await user.click(await screen.findByRole('button', { name: 'common.delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('settings.modalities.errors.inUse');
  });
});
