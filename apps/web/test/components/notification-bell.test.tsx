import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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
      { studentId: 's1', studentName: 'João', planName: 'Monthly', daysOverdue: 3, phone: '5511999', notificationsMuted: false },
      { studentId: 's2', studentName: 'Maria', planName: 'Monthly', daysOverdue: 7, phone: '5511888', notificationsMuted: false },
    ] as any);
    renderWithProviders(<NotificationBell />);
    await waitFor(() => { expect(screen.getByText('2')).toBeInTheDocument(); });
  });

  it('excludes muted students from badge count', async () => {
    mockApi.mockResolvedValue([
      { studentId: 's1', studentName: 'João', planName: 'Monthly', daysOverdue: 3, phone: '5511999', notificationsMuted: false },
      { studentId: 's2', studentName: 'Maria', planName: 'Monthly', daysOverdue: 7, phone: '5511888', notificationsMuted: true },
    ] as any);
    renderWithProviders(<NotificationBell />);
    await waitFor(() => { expect(screen.getByText('1')).toBeInTheDocument(); });
  });

  it('hides badge when no overdue students', async () => {
    mockApi.mockResolvedValue([] as any);
    renderWithProviders(<NotificationBell />);
    await waitFor(() => { expect(screen.queryByText('0')).not.toBeInTheDocument(); });
  });
});
