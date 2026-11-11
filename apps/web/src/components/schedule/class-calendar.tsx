import { Calendar, dateFnsLocalizer, type EventProps } from 'react-big-calendar';
import withDragAndDrop, {
  type EventInteractionArgs,
} from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './class-calendar.css';
import type { CalendarEvent, CalendarRange } from '@/lib/schedule';

const locales = { 'en-US': enUS, 'pt-BR': ptBR };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

// `Calendar as any`: RBC's public `Calendar` is typed as a class whose
// generic doesn't line up with `withDragAndDrop`'s expected constructor
// signature. The cast is load-bearing and limited to this single line.
const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar as any);

// Week/day views open at 06:00 instead of midnight; earlier slots stay reachable by scrolling.
const SCROLL_TO_TIME = new Date(1970, 0, 1, 6, 0);

function i18nToCulture(language: string | undefined): 'en-US' | 'pt-BR' {
  if (!language) return 'pt-BR';
  return language.toLowerCase().startsWith('en') ? 'en-US' : 'pt-BR';
}

// Seminars get the amber look; events shorter than 1 hour hide their time
// label in CSS — the duration is too tight to read both lines.
export function eventPropGetter(event: CalendarEvent): { className?: string } {
  const durationMin = (event.end.getTime() - event.start.getTime()) / 60_000;
  const classes = [event.resource.isSeminar && 'cc-event-seminar', durationMin < 60 && 'cc-event-short'].filter(Boolean);
  return classes.length ? { className: classes.join(' ') } : {};
}

// A single-date class (every Seminar) keeps its date: the API ignores a new weekday for it.
export function isDraggable(event: CalendarEvent): boolean {
  return event.resource.recurrence !== 'once';
}

export interface ClassCalendarProps {
  events: CalendarEvent[];
  view: CalendarRange;
  date: Date;
  onViewChange: (v: CalendarRange) => void;
  onDateChange: (d: Date) => void;
  onEventDrop: (eventId: string, newStart: Date, newEnd: Date) => void;
  onEventClick: (eventId: string) => void;
  readOnly?: boolean;
  toolbar?: boolean;
  culture?: string;
  renderEvent?: (event: CalendarEvent) => React.ReactNode;
}

export function ClassCalendar(props: ClassCalendarProps) {
  const { t, i18n } = useTranslation();
  const {
    events,
    view,
    date,
    onViewChange,
    onDateChange,
    onEventDrop,
    onEventClick,
    readOnly = false,
    toolbar = true,
    culture = i18nToCulture(i18n.language),
    renderEvent,
  } = props;

  const messages = {
    today: t('calendar.today'),
    previous: t('calendar.previous'),
    next: t('calendar.next'),
    month: t('calendar.month'),
    week: t('calendar.week'),
    day: t('calendar.day'),
    agenda: t('calendar.agenda'),
    date: t('calendar.date'),
    time: t('calendar.time'),
    event: t('calendar.event'),
    allDay: t('calendar.allDay'),
    noEventsInRange: t('calendar.noEvents'),
    showMore: (count: number) => t('calendar.showMore', { count }),
  };

  const components = renderEvent
    ? {
        event: ({ event }: EventProps<CalendarEvent>) => <>{renderEvent(event)}</>,
      }
    : undefined;

  return (
    <DnDCalendar
      localizer={localizer}
      culture={culture}
      messages={messages}
      events={events}
      view={view}
      onView={(v) => onViewChange(v as CalendarRange)}
      date={date}
      onNavigate={(d) => onDateChange(d)}
      views={['month', 'week', 'day']}
      toolbar={toolbar}
      startAccessor="start"
      titleAccessor={(e: CalendarEvent) => (e.resource.isSeminar ? `${t('seminars.label')} · ${e.title}` : e.title)}
      endAccessor="end"
      draggableAccessor={(e: CalendarEvent) => !readOnly && isDraggable(e)}
      resizable={false}
      onEventDrop={(args: EventInteractionArgs<CalendarEvent>) => {
        if (readOnly) return;
        onEventDrop(args.event.id, args.start as Date, args.end as Date);
      }}
      onSelectEvent={(e) => onEventClick(e.id)}
      eventPropGetter={eventPropGetter}
      components={components}
      scrollToTime={SCROLL_TO_TIME}
      style={{ height: 600 }}
    />
  );
}
