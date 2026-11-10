import { describe, it, expect } from 'vitest';
import {
  isActiveNow,
  slotState,
  dateForWeekday,
  classesOn,
  groupByStart,
  teacherTitle,
  classesToCalendarEvents,
  type ClassItem,
} from '@/lib/schedule';

// Tuesday 10 Nov 2026
const tue = (h: number, m = 0) => new Date(2026, 10, 10, h, m);

function cls(over: Partial<ClassItem>): ClassItem {
  return {
    id: 'c',
    name: 'Fundamentos',
    type: 'gi',
    recurrence: 'weekly',
    dayOfWeek: 2,
    date: null,
    startTime: '19:00',
    endTime: '20:00',
    ...over,
  };
}

describe('slotState', () => {
  const c = cls({});
  it.each([
    [tue(18, 30), 'upcoming'],
    [tue(18, 45), 'soon'],
    [tue(19, 0), 'live'],
    [tue(19, 59), 'live'],
    [tue(20, 0), 'open-after'],
    [tue(21, 0), 'open-after'],
    [tue(21, 1), 'past'],
  ] as const)('at %s is %s', (now, state) => {
    expect(slotState(c, now)).toBe(state);
  });
});

describe('isActiveNow', () => {
  it('a one-off class is only active on its own date', () => {
    const once = cls({ recurrence: 'once', date: '2026-11-17', dayOfWeek: 2 });
    expect(isActiveNow(once, tue(19, 10))).toBe(false);
    expect(isActiveNow(once, new Date(2026, 10, 17, 19, 10))).toBe(true);
  });
});

describe('dateForWeekday', () => {
  it('is today for today and the next occurrence for any other day', () => {
    expect(dateForWeekday(2, tue(9)).getDate()).toBe(10);
    expect(dateForWeekday(6, tue(9)).getDate()).toBe(14); // Saturday
    expect(dateForWeekday(1, tue(9)).getDate()).toBe(16); // next Monday
  });
});

describe('classesOn', () => {
  it('weekly classes by weekday, one-off classes only on their date', () => {
    const weekly = cls({ id: 'w', dayOfWeek: 6 });
    const thisSat = cls({ id: 'a', recurrence: 'once', date: '2026-11-14', dayOfWeek: 6 });
    const laterSat = cls({ id: 'b', recurrence: 'once', date: '2026-11-21', dayOfWeek: 6 });
    const ids = classesOn([weekly, thisSat, laterSat], new Date(2026, 10, 14)).map((c) => c.id);
    expect(ids).toEqual(['w', 'a']);
  });
});

describe('groupByStart', () => {
  it('groups classes that start together, in time order', () => {
    const groups = groupByStart([
      cls({ id: 'late', startTime: '20:00', endTime: '21:00' }),
      cls({ id: 'gi', startTime: '19:00' }),
      cls({ id: 'kids', startTime: '19:00' }),
      cls({ id: 'early', startTime: '07:00', endTime: '08:30' }),
    ]);
    expect(groups.map((g) => g.map((c) => c.id))).toEqual([['early'], ['gi', 'kids'], ['late']]);
  });
});

describe('teacherTitle', () => {
  it('black is professor, purple and brown are instructor, anything else has no title', () => {
    expect(teacherTitle('black')).toBe('Professor');
    expect(teacherTitle('brown')).toBe('Instructor');
    expect(teacherTitle('purple')).toBe('Instructor');
    expect(teacherTitle('blue')).toBeNull();
    expect(teacherTitle('white')).toBeNull();
  });
});

describe('classesToCalendarEvents with one-off classes', () => {
  it('week range shows a one-off class only in its own week', () => {
    const once = cls({ id: 'o', recurrence: 'once', date: '2026-11-21', dayOfWeek: 6 });
    expect(classesToCalendarEvents([once], tue(9), 'week')).toHaveLength(0);
    expect(classesToCalendarEvents([once], new Date(2026, 10, 18), 'week')).toHaveLength(1);
  });
});
