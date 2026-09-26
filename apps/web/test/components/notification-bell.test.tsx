import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import { NotificationBell } from '@/components/notification-bell';

vi.mock('@/lib/auth-client', () => ({ useSession: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: vi.fn() }));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';

const mockUseSession = vi.mocked(useSession);
const mockApi = vi.mocked(api);

const instructorSession = {
  data: { user: { id: 'u1', name: 'Instructor', role: 'owner', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(instructorSession);
  });

  it('shows badge count for overdue students', async () => {
    mockApi.mockResolvedValue([
      { studentId: 's1', studentName: 'João', kind: 'student', amountDue: '45.00', daysOverdue: 3, phone: '5511999', notificationsMuted: false },
      { studentId: 's2', studentName: 'Maria', kind: 'student', amountDue: '45.00', daysOverdue: 7, phone: '5511888', notificationsMuted: false },
    ] as any);
    renderWithProviders(<NotificationBell />);
    await waitFor(() => { expect(screen.getByText('2')).toBeInTheDocument(); });
  });

  it('excludes muted students from badge count', async () => {
    mockApi.mockResolvedValue([
      { studentId: 's1', studentName: 'João', kind: 'student', amountDue: '45.00', daysOverdue: 3, phone: '5511999', notificationsMuted: false },
      { studentId: 's2', studentName: 'Maria', kind: 'student', amountDue: '45.00', daysOverdue: 7, phone: '5511888', notificationsMuted: true },
    ] as any);
    renderWithProviders(<NotificationBell />);
    await waitFor(() => { expect(screen.getByText('1')).toBeInTheDocument(); });
  });

  it('hides badge when no overdue students', async () => {
    mockApi.mockResolvedValue([] as any);
    renderWithProviders(<NotificationBell />);
    await waitFor(() => { expect(screen.queryByText('0')).not.toBeInTheDocument(); });
  });

  it('lists families by name with WhatsApp only, and shows the amount owed', async () => {
    mockApi.mockResolvedValue([
      { kind: 'student', studentId: 's1', studentName: 'João', amountDue: '45.00', daysOverdue: 3, phone: null, notificationsMuted: false },
      { kind: 'family', familyId: 'f1', familyName: 'Família Silva', members: [{ studentId: 's2', name: 'Bia' }], amountDue: '70.00', daysOverdue: 10, phone: '911111111', missedMonths: ['2026-09'] },
    ] as any);
    renderWithProviders(<NotificationBell />);
    await waitFor(() => { expect(screen.getByText('2')).toBeInTheDocument(); });
    await userEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByText('Família Silva')).toBeInTheDocument();
    expect(screen.getByText(/70,00\s€/)).toBeInTheDocument();
    expect(screen.getByText(/45,00\s€/)).toBeInTheDocument();
    // email/mute are per student: only João has them
    expect(screen.getAllByRole('button', { name: /notifications\.sendEmail/ })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /notifications\.sendReminder/ })).toHaveLength(1);
  });
});
