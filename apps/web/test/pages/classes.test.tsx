import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../render';
import ClassesPage from '@/pages/classes/index';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';

const mockUseSession = vi.mocked(useSession);
const mockApi = vi.mocked(api);

const instructorSession = {
  data: { user: { id: 'u1', name: 'Instructor', role: 'instructor', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const studentSession = {
  data: { user: { id: 'u2', name: 'Student', role: 'student', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const now = new Date();
const mockClasses = [
  {
    id: 'c1',
    name: 'Morning Gi',
    type: 'gi',
    dayOfWeek: now.getDay(),
    startTime: `${String(now.getHours()).padStart(2, '0')}:00`,
    endTime: `${String(now.getHours() + 1).padStart(2, '0')}:30`,
    instructor: 'Prof Silva',
  },
  {
    id: 'c2',
    name: 'No-Gi Night',
    type: 'no-gi',
    dayOfWeek: (now.getDay() + 3) % 7,
    startTime: '19:00',
    endTime: '20:30',
  },
];

describe('ClassesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(instructorSession);
    mockApi.mockResolvedValue(mockClasses as any);
  });

  it('renders page title', async () => {
    renderWithProviders(<ClassesPage />);
    await waitFor(() => {
      expect(screen.getByText('classes.title')).toBeInTheDocument();
    });
  });

  it('shows class cards after API fetch', async () => {
    renderWithProviders(<ClassesPage />);
    expect(await screen.findByText('Morning Gi')).toBeInTheDocument();
    expect(screen.getByText('No-Gi Night')).toBeInTheDocument();
    expect(screen.getByText('Prof Silva')).toBeInTheDocument();
  });

  it('shows create button for instructors', async () => {
    renderWithProviders(<ClassesPage />);
    await waitFor(() => {
      expect(screen.getByText('classes.createClass')).toBeInTheDocument();
    });
  });

  it('shows checkin buttons only for active classes for students', async () => {
    mockUseSession.mockReturnValue(studentSession);
    renderWithProviders(<ClassesPage />);

    await screen.findByText('Morning Gi');
    const checkinButtons = screen.getAllByText('classes.checkinProximity');
    expect(checkinButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when no classes', async () => {
    mockApi.mockResolvedValue([] as any);
    renderWithProviders(<ClassesPage />);
    expect(await screen.findByText('common.noResults')).toBeInTheDocument();
  });

  it('shows edit and delete buttons for instructors', async () => {
    renderWithProviders(<ClassesPage />);
    await screen.findByText('Morning Gi');
    const editButtons = screen.getAllByLabelText('classes.editClass');
    const deleteButtons = screen.getAllByLabelText('classes.deleteClass');
    expect(editButtons.length).toBe(2);
    expect(deleteButtons.length).toBe(2);
  });

  it('does not show edit/delete buttons for students', async () => {
    mockUseSession.mockReturnValue(studentSession);
    renderWithProviders(<ClassesPage />);
    await screen.findByText('Morning Gi');
    expect(screen.queryByLabelText('classes.editClass')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('classes.deleteClass')).not.toBeInTheDocument();
  });
});
