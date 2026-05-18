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
// and fire `onEventDrop`/`onEventClick` directly without mounting RBC.
//
// capturedProps is module-level because the factory passed to vi.mock() is
// hoisted above all imports; a stable reference is needed so the mock and the
// tests see the same object. Vitest runs tests within a file sequentially, so
// the `beforeEach` reset below is sufficient. Cross-file isolation is handled
// by vitest's per-file worker model.
//
// The student-view test uses <div> instead of <button> here because its
// renderEvent prop returns a <Button>, and button-in-button is invalid HTML.
let capturedProps: any = {};
vi.mock('@/components/schedule/class-calendar', () => ({
  ClassCalendar: (props: any) => {
    capturedProps = props;
    return (
      <div data-testid="class-calendar">
        {props.events.map((e: any) => (
          <button
            key={e.id}
            data-testid={`event-${e.id}`}
            onClick={() => props.onEventClick(e.id)}
          >
            {props.renderEvent ? props.renderEvent(e) : e.title}
          </button>
        ))}
      </div>
    );
  },
}));

// Stub dialogs — we only care about the edit dialog for click/delete tests
vi.mock('@/components/schedule/class-create-dialog', () => ({
  ClassCreateDialog: () => null,
}));

vi.mock('@/components/tabs-nav', () => ({
  TabsNav: () => null,
}));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { InstructorClassesView } from '@/pages/classes/instructor-view';

const mockUseSession = vi.mocked(useSession);
const mockApi = vi.mocked(api);

const instructorSession = {
  data: { user: { id: 'u1', role: 'owner', academyId: 'a1', status: 'active' } },
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

describe('InstructorClassesView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedProps = {};
    mockUseSession.mockReturnValue(instructorSession);
    // Default: first call resolves with classes (query), subsequent ones resolve OK
    mockApi.mockResolvedValue(mockClasses as any);
    // Override the global matchMedia stub (returns false) so useClassCalendar
    // picks 'week' view; otherwise 'day' filters out classes for other days.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (q: string) => ({
        matches: true,
        media: q,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  });

  it('drag fires PUT /classes/:id with correct body', async () => {
    renderWithProviders(<InstructorClassesView />);

    // Wait for query to populate the calendar
    await waitFor(() => expect(capturedProps.events?.find((e: any) => e.id === "c1")).toBeDefined());

    // Resolve the PUT call as success
    mockApi.mockResolvedValueOnce({} as any);

    const newStart = new Date(2026, 3, 22, 9, 15); // Wednesday
    const newEnd = new Date(2026, 3, 22, 10, 45);

    capturedProps.onEventDrop('c1', newStart, newEnd);

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith(
        '/classes/c1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ dayOfWeek: 3, startTime: '09:15', endTime: '10:45' }),
        }),
      );
    });
  });

  it('optimistic update flips class in cache before server responds', async () => {
    renderWithProviders(<InstructorClassesView />);

    await waitFor(() => expect(capturedProps.events?.find((e: any) => e.id === "c1")).toBeDefined());

    // ONLY the PUT hangs — subsequent api() calls (background refetches
    // triggered by cancelQueries) fall back to the default mockResolvedValue.
    mockApi.mockImplementationOnce(() => new Promise(() => {}));

    const newStart = new Date(2026, 3, 22, 9, 15); // Wednesday = dayOfWeek 3
    const newEnd = new Date(2026, 3, 22, 10, 45);

    capturedProps.onEventDrop('c1', newStart, newEnd);

    await waitFor(() => {
      const c1Event = capturedProps.events.find((e: any) => e.id === 'c1');
      expect(c1Event).toBeDefined();
      // The resource should have been updated optimistically
      expect(c1Event.resource.dayOfWeek).toBe(3);
      expect(c1Event.resource.startTime).toBe('09:15');
      expect(c1Event.resource.endTime).toBe('10:45');
    });
  });

  it('drag failure rolls back to original classes', async () => {
    renderWithProviders(<InstructorClassesView />);

    await waitFor(() => expect(capturedProps.events?.find((e: any) => e.id === "c1")).toBeDefined());

    // Capture original events
    const originalC1 = capturedProps.events.find((e: any) => e.id === 'c1');
    const originalDayOfWeek = originalC1?.resource.dayOfWeek;
    const originalStartTime = originalC1?.resource.startTime;

    // PUT rejects
    mockApi.mockRejectedValueOnce(new Error('boom'));

    const newStart = new Date(2026, 3, 22, 9, 15);
    const newEnd = new Date(2026, 3, 22, 10, 45);

    capturedProps.onEventDrop('c1', newStart, newEnd);

    await waitFor(() => {
      // MutationCache.onError fires toast.error with the error message
      expect(toast.error).toHaveBeenCalledWith('boom');
    });

    await waitFor(() => {
      const c1Event = capturedProps.events.find((e: any) => e.id === 'c1');
      expect(c1Event).toBeDefined();
      expect(c1Event.resource.dayOfWeek).toBe(originalDayOfWeek);
      expect(c1Event.resource.startTime).toBe(originalStartTime);
    });
  });

  it('click opens edit dialog pre-filled with class name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InstructorClassesView />);

    await waitFor(() => expect(capturedProps.events?.find((e: any) => e.id === "c1")).toBeDefined());

    // Find the rendered event button and click it
    const eventButton = await screen.findByTestId('event-c1');
    await user.click(eventButton);

    // Dialog should appear with the editClass title
    await waitFor(() => {
      expect(screen.getByText('classes.editClass')).toBeInTheDocument();
    });

    // The class name 'Morning Gi' should be pre-filled in the input
    await waitFor(() => {
      const input = screen.getByDisplayValue('Morning Gi');
      expect(input).toBeInTheDocument();
    });
  });

  it('delete button fires DELETE /classes/:id and closes dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InstructorClassesView />);

    await waitFor(() => expect(capturedProps.events?.find((e: any) => e.id === "c1")).toBeDefined());

    // Open dialog via click
    const eventButton = await screen.findByTestId('event-c1');
    await user.click(eventButton);

    await waitFor(() => {
      expect(screen.getByText('classes.editClass')).toBeInTheDocument();
    });

    // Mock successful DELETE
    mockApi.mockResolvedValueOnce({} as any);

    // Click the initial delete button (opens confirm state)
    const deleteBtn = screen.getByText('classes.deleteClass');
    await user.click(deleteBtn);

    // Click confirm delete button (second deleteClass button appears in confirm panel)
    await waitFor(() => {
      expect(screen.getByText('classes.confirmDelete')).toBeInTheDocument();
    });

    const allDeleteBtns = screen.getAllByText('classes.deleteClass');
    // The confirm button is the last one
    await user.click(allDeleteBtns[allDeleteBtns.length - 1]);

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith(
        '/classes/c1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    // Dialog should close (editClass title gone)
    await waitFor(() => {
      expect(screen.queryByText('classes.editClass')).not.toBeInTheDocument();
    });
  });
});
