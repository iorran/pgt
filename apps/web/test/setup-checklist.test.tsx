import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));
vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

type Data = { modalities: unknown[]; classes: unknown[]; students: unknown[]; checkins: unknown[] };

const mockApi = async (data: Data) => {
  const { api } = await import('@/lib/api');
  vi.mocked(api).mockImplementation(async (path: string) => {
    if (path.startsWith('/modalities')) {
      return data.modalities;
    }
    if (path.startsWith('/classes')) {
      return data.classes;
    }
    if (path.startsWith('/students')) {
      return data.students;
    }
    if (path.startsWith('/checkins/academy')) {
      return data.checkins;
    }
    return {};
  });
};

const renderChecklist = async () => {
  const { SetupChecklist } = await import('@/pages/owner/components/setup-checklist');
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SetupChecklist />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('SetupChecklist', () => {
  beforeEach(async () => {
    const { useSession } = await import('@/lib/auth-client');
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: 'own-1', role: 'owner', academyId: 'aca-1' } },
    } as any);
  });

  it('marks steps done or pending from real data', async () => {
    await mockApi({ modalities: [{ id: 'm1' }], classes: [{ id: 'c1' }], students: [], checkins: [] });
    await renderChecklist();

    await waitFor(() => expect(screen.getByText('setupChecklist.title')).toBeInTheDocument());
    expect(screen.getByTestId('setup-step-modality')).toHaveAttribute('data-done', 'true');
    expect(screen.getByTestId('setup-step-class')).toHaveAttribute('data-done', 'true');
    expect(screen.getByTestId('setup-step-student')).toHaveAttribute('data-done', 'false');
    expect(screen.getByTestId('setup-step-checkin')).toHaveAttribute('data-done', 'false');
  });

  it('links each step to its screen and help section', async () => {
    await mockApi({ modalities: [], classes: [], students: [], checkins: [] });
    await renderChecklist();

    await waitFor(() => expect(screen.getByText('setupChecklist.title')).toBeInTheDocument());
    const expected: Array<[string, string, string]> = [
      ['modality', '/settings', 'Primeiros Passos'],
      ['class', '/classes', 'Aulas'],
      ['student', '/students', 'Gerenciando Alunos'],
      ['checkin', '/totem', 'Sistema de Check-in'],
    ];
    for (const [step, route, section] of expected) {
      const item = screen.getByTestId(`setup-step-${step}`);
      const links = item.querySelectorAll('a');
      expect(links[0]).toHaveAttribute('href', route);
      expect(links[1]).toHaveAttribute('href', `/ajuda#${encodeURIComponent(section)}`);
    }
  });

  it('renders nothing when every step is done', async () => {
    await mockApi({
      modalities: [{ id: 'm1' }],
      classes: [{ id: 'c1' }],
      students: [{ id: 's1' }],
      checkins: [{ id: 'k1' }],
    });
    const { container } = await renderChecklist();

    const { api } = await import('@/lib/api');
    await waitFor(() => expect(vi.mocked(api)).toHaveBeenCalledWith('/checkins/academy'));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('setupChecklist.title')).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });
});
