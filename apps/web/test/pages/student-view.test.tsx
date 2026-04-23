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

// Mock ClassCalendar — captures the latest props so tests can inspect `events`
// and trigger the rendered event buttons without mounting RBC.
//
// capturedProps is module-level because the vi.mock() factory is hoisted above
// imports; the `beforeEach` reset below keeps within-file tests isolated.
// Vitest's per-file worker model handles cross-file isolation.
//
// Uses <div> (not <button>) for the event wrapper because renderEvent returns
// a <Button> for active classes — nesting buttons is invalid HTML.
let capturedProps: any = {};
vi.mock('@/components/schedule/class-calendar', () => ({
  ClassCalendar: (props: any) => {
    capturedProps = props;
    return (
      <div data-testid="class-calendar">
        {props.events.map((e: any) => (
          <div
            key={e.id}
            data-testid={`event-${e.id}`}
            onClick={() => props.onEventClick && props.onEventClick(e.id)}
          >
            {props.renderEvent ? props.renderEvent(e) : e.title}
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock('@/components/tabs-nav', () => ({
  TabsNav: () => null,
}));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
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
    capturedProps = {};
    mockUseSession.mockReturnValue(studentSession);
  });

  it("today's classes are passed to the calendar as events", async () => {
    mockApi
      .mockResolvedValueOnce(mockClasses as any)
      .mockResolvedValueOnce([] as any);

    renderWithProviders(<StudentClassesView />);

    await waitFor(() => expect(capturedProps.events).toBeDefined());

    // Student view uses 'day' view by default → only today's classes appear
    const eventIds = capturedProps.events.map((e: any) => e.id);
    expect(eventIds).toContain('c1'); // c1 has today's dayOfWeek
    // c2 is 3 days away → should NOT appear in day view
    expect(eventIds).not.toContain('c2');
  });

  it('shows no-results message and no calendar when no classes today', async () => {
    // All classes on a different day — none match today
    const otherDow = (now.getDay() + 4) % 7;
    const noTodayClasses = [
      { id: 'x1', name: 'Future Gi', type: 'gi', dayOfWeek: otherDow, startTime: '10:00', endTime: '11:00' },
    ];
    mockApi
      .mockResolvedValueOnce(noTodayClasses as any)
      .mockResolvedValueOnce([] as any);

    renderWithProviders(<StudentClassesView />);

    await waitFor(() => {
      expect(screen.queryByTestId('class-calendar')).not.toBeInTheDocument();
      expect(screen.getByText('common.noResults')).toBeInTheDocument();
    });
  });

  it('active class renders check-in button inside event', async () => {
    const activeClass = makeActiveClass();
    mockApi
      .mockResolvedValueOnce([activeClass] as any)
      .mockResolvedValueOnce([] as any);

    renderWithProviders(<StudentClassesView />);

    await waitFor(() => expect(capturedProps.events).toBeDefined());

    // The calendar renders each event via props.renderEvent; find the checkin button
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

    await waitFor(() => expect(capturedProps.events).toBeDefined());

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
});
