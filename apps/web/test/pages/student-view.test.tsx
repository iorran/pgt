import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

vi.mock('@/components/tabs-nav', () => ({
  TabsNav: () => null,
}));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { StudentClassesView } from '@/pages/classes/student-view';

const mockUseSession = vi.mocked(useSession);
const mockApi = vi.mocked(api);

const studentSession = {
  data: { user: { id: 'u2', role: 'student', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const now = new Date();

// A class active right now: dayOfWeek matches today, time window straddles now
// isActiveNow: nowMin >= sh*60+sm-15 && nowMin <= eh*60+em+60
// We set start = now-30min, end = now+30min → clearly within window
function makeActiveClass() {
  const startH = now.getHours();
  const startM = Math.max(0, now.getMinutes() - 30);
  const endH = startM >= 30 ? now.getHours() : now.getHours() + 1;
  const endM = (startM + 60) % 60;
  return {
    id: 'active1',
    name: 'Live Gi',
    type: 'gi',
    dayOfWeek: now.getDay(),
    startTime: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
    endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
  };
}

const mockClasses = [
  {
    id: 'c1',
    name: 'Morning Gi',
    type: 'gi',
    dayOfWeek: now.getDay(),
    startTime: `${String(now.getHours()).padStart(2, '0')}:00`,
    endTime: `${String(now.getHours() + 1).padStart(2, '0')}:30`,
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

describe('StudentClassesView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(studentSession);
  });

  it('shows the first check-in notice while the student has zero check-ins', async () => {
    mockApi.mockImplementation(async (path: string) => (path.startsWith('/classes') ? mockClasses : []) as any);
    renderWithProviders(<StudentClassesView />);
    expect(await screen.findByText('firstAccess.noticeTitle')).toBeInTheDocument();
  });

  it('hides the first check-in notice once the student has check-ins', async () => {
    mockApi.mockImplementation(
      async (path: string) => (path.startsWith('/classes') ? mockClasses : [{ id: 'ck1', checkedInAt: '2026-01-01T10:00:00Z', class: null }]) as any,
    );
    renderWithProviders(<StudentClassesView />);
    await screen.findByText('Morning Gi');
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/checkins/student/u2'));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('firstAccess.noticeTitle')).not.toBeInTheDocument();
  });

  it("lists today's classes as cards, like the owner's day list", async () => {
    mockApi.mockImplementation(async (path: string) => (path.startsWith('/classes') ? mockClasses : []) as any);
    renderWithProviders(<StudentClassesView />);

    expect(await screen.findByText('Morning Gi')).toBeInTheDocument();
    expect(screen.queryByText('No-Gi Night')).not.toBeInTheDocument();
    // The owner-only attendance feed is never requested for a student.
    expect(mockApi).not.toHaveBeenCalledWith('/checkins/academy');
  });

  it('another day shows its classes without a check-in button', async () => {
    const user = userEvent.setup();
    mockApi.mockImplementation(async (path: string) => (path.startsWith('/classes') ? [makeActiveClass(), mockClasses[1]] : []) as any);
    renderWithProviders(<StudentClassesView />);
    await screen.findByText('classes.checkinProximity');

    const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    await user.click(screen.getByRole('button', { name: `classes.days.${keys[mockClasses[1].dayOfWeek]}` }));

    expect(screen.getByText('No-Gi Night')).toBeInTheDocument();
    expect(screen.queryByText('classes.checkinProximity')).not.toBeInTheDocument();
  });

  it('shows checked-in instead of the button once the student is present', async () => {
    const activeClass = makeActiveClass();
    mockApi.mockImplementation(async (path: string) =>
      (path.startsWith('/classes')
        ? [activeClass]
        : [{ id: 'k1', checkedInAt: new Date().toISOString(), class: { id: activeClass.id } }]) as any,
    );
    renderWithProviders(<StudentClassesView />);

    expect(await screen.findByText('classes.checkedIn')).toBeInTheDocument();
    expect(screen.queryByText('classes.checkinProximity')).not.toBeInTheDocument();
  });

  it('pins the live class above earlier classes of the day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 10, 19, 15)); // Tuesday evening
    try {
      const day = new Date().getDay();
      mockApi.mockImplementation(async (path: string) =>
        (path.startsWith('/classes')
          ? [
              { id: 'm', name: 'Morning Gi', type: 'gi', dayOfWeek: day, startTime: '07:00', endTime: '08:00' },
              { id: 'e', name: 'Evening Gi', type: 'gi', dayOfWeek: day, startTime: '19:00', endTime: '20:00' },
            ]
          : []) as any,
      );
      renderWithProviders(<StudentClassesView />);

      await screen.findByText('Evening Gi');
      const names = screen.getAllByRole('listitem').map((li) => li.textContent);
      expect(names[0]).toContain('Evening Gi');
      expect(names[1]).toContain('Morning Gi');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows no-results message when the academy has no classes', async () => {
    mockApi.mockResolvedValue([] as any);
    renderWithProviders(<StudentClassesView />);
    expect(await screen.findByText('common.noResults')).toBeInTheDocument();
  });

  it('active class renders a check-in button on its card', async () => {
    const activeClass = makeActiveClass();
    mockApi
      .mockResolvedValueOnce([activeClass] as any)
      .mockResolvedValueOnce([] as any);

    renderWithProviders(<StudentClassesView />);

    await waitFor(() => {
      expect(screen.getByText('classes.checkinProximity')).toBeInTheDocument();
    });
  });

  it('tapping check-in calls geolocation then POST /checkins', async () => {
    const user = userEvent.setup();
    const activeClass = makeActiveClass();

    mockApi
      .mockResolvedValueOnce([activeClass] as any)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce({} as any); // POST /checkins

    // Mock geolocation to succeed immediately
    const geo = {
      getCurrentPosition: vi.fn((success: any) =>
        success({ coords: { latitude: -23.5, longitude: -46.6 } }),
      ),
    };
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: geo,
      configurable: true,
    });

    renderWithProviders(<StudentClassesView />);

    const checkinBtn = await screen.findByText('classes.checkinProximity');
    await user.click(checkinBtn);

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith(
        '/checkins',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            classId: activeClass.id,
            source: 'button',
            latitude: -23.5,
            longitude: -46.6,
          }),
        }),
      );
    });
  });

  it.each([
    [1, 'classes.locationDenied'],
    [2, 'classes.locationUnavailable'],
    [3, 'classes.locationUnavailable'],
  ])('geolocation error code %i shows %s', async (code, key) => {
    const user = userEvent.setup();
    mockApi.mockResolvedValueOnce([makeActiveClass()] as any).mockResolvedValueOnce([] as any);
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((_ok: any, fail: any) =>
          fail({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }),
        ),
      },
      configurable: true,
    });

    renderWithProviders(<StudentClassesView />);
    await user.click(await screen.findByText('classes.checkinProximity'));

    expect(toast.error).toHaveBeenCalledWith(key, ...(code === 1 ? [{ description: 'classes.locationDeniedHelp' }] : []));
    expect(mockApi).not.toHaveBeenCalledWith('/checkins', expect.anything());
  });
});
