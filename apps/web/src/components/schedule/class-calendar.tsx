import { Calendar, dateFnsLocalizer, type EventProps } from 'react-big-calendar';
import withDragAndDrop, {
  type EventInteractionArgs,
} from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
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

const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar as any);

const TYPE_CLASS: Record<string, string> = {
  gi: 'cc-event-gi',
  'no-gi': 'cc-event-nogi',
  'open-mat': 'cc-event-openmat',
  kids: 'cc-event-kids',
};

function eventPropGetter(event: CalendarEvent) {
  const key = event.resource.type.toLowerCase().trim();
  return { className: TYPE_CLASS[key] ?? 'cc-event-default' };
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
    culture = 'pt-BR',
    renderEvent,
  } = props;

  const components = renderEvent
    ? {
        event: ({ event }: EventProps<CalendarEvent>) => <>{renderEvent(event)}</>,
      }
    : undefined;

  return (
    <DnDCalendar
      localizer={localizer}
      culture={culture}
      events={events}
      view={view}
      onView={(v) => onViewChange(v as CalendarRange)}
      date={date}
      onNavigate={(d) => onDateChange(d)}
      views={['month', 'week', 'day']}
      toolbar={toolbar}
      startAccessor="start"
      endAccessor="end"
      draggableAccessor={() => !readOnly}
      resizable={false}
      onEventDrop={(args: EventInteractionArgs<CalendarEvent>) => {
        if (readOnly) return;
        onEventDrop(args.event.id, args.start as Date, args.end as Date);
      }}
      onSelectEvent={(e) => onEventClick(e.id)}
      eventPropGetter={eventPropGetter}
      components={components}
      style={{ height: 600 }}
    />
  );
}
