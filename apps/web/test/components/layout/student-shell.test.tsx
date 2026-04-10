import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { StudentShell } from '@/components/layout/student-shell';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

import { useSession } from '@/lib/auth-client';

const mockedUseSession = vi.mocked(useSession);

function renderShell() {
  mockedUseSession.mockReturnValue({
    data: { user: { name: 'Aluno', role: 'student', academyName: 'Ac' } },
    isPending: false,
  } as any);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/classes']}>
        <Routes>
          <Route element={<StudentShell />}>
            <Route path="/classes" element={<div>classes-content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('StudentShell', () => {
  beforeEach(() => {
    mockedUseSession.mockReset();
  });

  it('renders header, outlet content, and bottom nav together', () => {
    renderShell();
    expect(screen.getByText('PGT')).toBeInTheDocument();
    expect(screen.getByText('classes-content')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /student bottom navigation/i })).toBeInTheDocument();
  });
});
