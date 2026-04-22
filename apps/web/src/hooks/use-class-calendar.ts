import { useState, useCallback, useMemo } from 'react';
import {
  classesToCalendarEvents,
  type CalendarEvent,
  type CalendarRange,
  type ClassItem,
} from '@/lib/schedule';

export interface UseClassCalendarOptions {
  classes: ClassItem[];
  onMove: (
    classId: string,
    patch: { dayOfWeek: number; startTime: string; endTime: string },
  ) => void;
  onSelect: (cls: ClassItem) => void;
  initialView?: CalendarRange;
  readOnly?: boolean;
}

export interface UseClassCalendarResult {
  events: CalendarEvent[];
  view: CalendarRange;
  date: Date;
  setView: (v: CalendarRange) => void;
  setDate: (d: Date) => void;
  onEventDrop: (eventId: string, newStart: Date, newEnd: Date) => void;
  onEventClick: (eventId: string) => void;
  readOnly: boolean;
}

function hhmm(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function pickDefaultView(initial: CalendarRange | undefined): CalendarRange {
  if (initial) return initial;
  if (typeof window === 'undefined') return 'week';
  return window.matchMedia('(min-width: 768px)').matches ? 'week' : 'day';
}

export function useClassCalendar(
  opts: UseClassCalendarOptions,
): UseClassCalendarResult {
  const { classes, onMove, onSelect, initialView, readOnly = false } = opts;

  const [view, setView] = useState<CalendarRange>(() => pickDefaultView(initialView));
  const [date, setDate] = useState<Date>(() => new Date());

  const events = useMemo(
    () => classesToCalendarEvents(classes, date, view),
    [classes, date, view],
  );

  const onEventDrop = useCallback(
    (eventId: string, newStart: Date, newEnd: Date) => {
      if (readOnly) return;
      onMove(eventId, {
        dayOfWeek: newStart.getDay(),
        startTime: hhmm(newStart),
        endTime: hhmm(newEnd),
      });
    },
    [onMove, readOnly],
  );

  const onEventClick = useCallback(
    (eventId: string) => {
      const match = classes.find((c) => c.id === eventId);
      if (match) onSelect(match);
    },
    [classes, onSelect],
  );

  return {
    events,
    view,
    date,
    setView,
    setDate,
    onEventDrop,
    onEventClick,
    readOnly,
  };
}
