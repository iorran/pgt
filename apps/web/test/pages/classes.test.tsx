import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('fires success toast when check-in succeeds', async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(studentSession);

    // First call returns the class list, second call (POST /checkins) returns an empty object.
    mockApi
      .mockResolvedValueOnce(mockClasses as any)
      .mockResolvedValueOnce([] as any) // myCheckins
      .mockResolvedValueOnce({} as any); // POST /checkins

    // Geolocation stub — success path
    const geo = {
      getCurrentPosition: vi.fn((success: any) =>
        success({ coords: { latitude: 0, longitude: 0 } }),
      ),
    };
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: geo,
      configurable: true,
    });

    renderWithProviders(<ClassesPage />);

    const proximityButton = await screen.findByText('classes.checkinProximity');
    await user.click(proximityButton);

    const { toast } = await import('@/lib/toast');
    await waitFor(() =>
      expect((toast as any).success).toHaveBeenCalledWith('classes.checkinSuccess'),
    );
  });

  it('allows changing dayOfWeek when editing a class', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClassesPage />);
    await screen.findByText('Morning Gi');

    const editButtons = screen.getAllByLabelText('classes.editClass');
    await user.click(editButtons[0]);

    const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const targetDay = (now.getDay() + 2) % 7;
    const targetLabel = `classes.days.${dayKeys[targetDay]}`;

    const targetButton = await screen.findByRole('button', { name: targetLabel });
    await user.click(targetButton);

    const saveButton = screen.getByRole('button', { name: 'common.save' });
    await user.click(saveButton);

    await waitFor(() => {
      const putCall = mockApi.mock.calls.find(
        (call) => typeof call[1] === 'object' && (call[1] as any)?.method === 'PUT',
      );
      expect(putCall).toBeDefined();
      const body = JSON.parse((putCall![1] as any).body);
      expect(body.dayOfWeek).toBe(targetDay);
    });
  });
});
