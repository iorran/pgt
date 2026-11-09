import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(() => ({ data: { user: { id: 'u2', role: 'student' } }, isPending: false })),
}));

import { FirstCheckinNotice } from '@/components/first-checkin-notice';

describe('FirstCheckinNotice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('shows the first check-in prompt with correct links', () => {
    renderWithProviders(<FirstCheckinNotice />);
    expect(screen.getByText('firstAccess.noticeTitle')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'firstAccess.noticeCheckin' })).toHaveAttribute('href', '/checkin');
    expect(screen.getByRole('link', { name: 'firstAccess.noticeGuide' })).toHaveAttribute(
      'href',
      `/ajuda?guia=aluno#${encodeURIComponent('Fazer Check-in nas Aulas')}`,
    );
  });

  it('hides after dismiss and stays hidden on remount', async () => {
    const { unmount } = renderWithProviders(<FirstCheckinNotice />);
    await userEvent.click(screen.getByRole('button', { name: 'firstAccess.noticeDismiss' }));
    expect(screen.queryByText('firstAccess.noticeTitle')).not.toBeInTheDocument();
    unmount();
    renderWithProviders(<FirstCheckinNotice />);
    expect(screen.queryByText('firstAccess.noticeTitle')).not.toBeInTheDocument();
  });
});
