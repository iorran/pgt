import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map((n) => parseInt(n, 10));
  const [eh, em] = end.split(':').map((n) => parseInt(n, 10));
  return eh * 60 + em - (sh * 60 + sm);
}

function addMinutes(d: Date, mins: number): string {
  const total = d.getHours() * 60 + d.getMinutes() + mins;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

  const [view, setViewState] = useState<CalendarRange>(() => pickDefaultView(initialView));
  const [date, setDate] = useState<Date>(() => new Date());
  const manualViewRef = useRef(false);

  // If the parent didn't pin a view, track the viewport breakpoint so
  // a resize (or device rotation) that crosses md switches month↔day
  // automatically. Suppressed once the user explicitly picks a view.
  useEffect(() => {
    if (initialView || typeof window === 'undefined') return;
    const mql = window.matchMedia('(min-width: 768px)');
    const onChange = () => {
      if (manualViewRef.current) return;
      setViewState(mql.matches ? 'week' : 'day');
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [initialView]);

  const setView = useCallback((v: CalendarRange) => {
    manualViewRef.current = true;
    setViewState(v);
  }, []);

  const events = useMemo(
    () => classesToCalendarEvents(classes, date, view),
    [classes, date, view],
  );

  // Keep a ref to the latest classes so onEventClick's identity is stable
  // across renders that only change the classes array reference.
  const classesRef = useRef(classes);
  classesRef.current = classes;

  const onEventDrop = useCallback(
    (eventId: string, newStart: Date, _newEnd: Date) => {
      if (readOnly) return;
      const cls = classesRef.current.find((c) => c.id === eventId);
      if (!cls) return;
      // Ignore RBC's suggested end — preserve the class's original duration.
      // Dropping into a shorter-than-duration target slot would otherwise
      // truncate the class; resize is handled only via the edit dialog.
      const durationMin = minutesBetween(cls.startTime, cls.endTime);
      onMove(eventId, {
        dayOfWeek: newStart.getDay(),
        startTime: hhmm(newStart),
        endTime: addMinutes(newStart, durationMin),
      });
    },
    [onMove, readOnly],
  );

  const onEventClick = useCallback(
    (eventId: string) => {
      const match = classesRef.current.find((c) => c.id === eventId);
      if (match) onSelect(match);
    },
    [onSelect],
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
