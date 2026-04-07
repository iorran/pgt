import { describe, it, expect, vi, afterEach } from 'vitest';
import { isClassActiveNow } from '../../src/utils/time-window';

describe('isClassActiveNow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true during class time', () => {
    vi.setSystemTime(new Date('2026-04-06T07:30:00'));
    expect(isClassActiveNow({
      recurrence: 'weekly',
      dayOfWeek: 1,
      date: null,
      startTime: '07:00',
      endTime: '08:30',
    })).toBe(true);
  });

  it('returns true 15 minutes before start', () => {
    vi.setSystemTime(new Date('2026-04-06T06:45:00'));
    expect(isClassActiveNow({
      recurrence: 'weekly',
      dayOfWeek: 1,
      date: null,
      startTime: '07:00',
      endTime: '08:30',
    })).toBe(true);
  });

  it('returns true 1 hour after end', () => {
    vi.setSystemTime(new Date('2026-04-06T09:29:00'));
    expect(isClassActiveNow({
      recurrence: 'weekly',
      dayOfWeek: 1,
      date: null,
      startTime: '07:00',
      endTime: '08:30',
    })).toBe(true);
  });

  it('returns false 16 minutes before start', () => {
    vi.setSystemTime(new Date('2026-04-06T06:44:00'));
    expect(isClassActiveNow({
      recurrence: 'weekly',
      dayOfWeek: 1,
      date: null,
      startTime: '07:00',
      endTime: '08:30',
    })).toBe(false);
  });

  it('returns false more than 1 hour after end', () => {
    vi.setSystemTime(new Date('2026-04-06T09:31:00'));
    expect(isClassActiveNow({
      recurrence: 'weekly',
      dayOfWeek: 1,
      date: null,
      startTime: '07:00',
      endTime: '08:30',
    })).toBe(false);
  });

  it('returns false on wrong day of week', () => {
    vi.setSystemTime(new Date('2026-04-07T07:30:00'));
    expect(isClassActiveNow({
      recurrence: 'weekly',
      dayOfWeek: 1,
      date: null,
      startTime: '07:00',
      endTime: '08:30',
    })).toBe(false);
  });

  it('handles one-time class by date', () => {
    vi.setSystemTime(new Date('2026-04-10T10:00:00'));
    expect(isClassActiveNow({
      recurrence: 'once',
      dayOfWeek: null,
      date: '2026-04-10',
      startTime: '09:30',
      endTime: '11:00',
    })).toBe(true);
  });

  it('returns false for one-time class on wrong date', () => {
    vi.setSystemTime(new Date('2026-04-11T10:00:00'));
    expect(isClassActiveNow({
      recurrence: 'once',
      dayOfWeek: null,
      date: '2026-04-10',
      startTime: '09:30',
      endTime: '11:00',
    })).toBe(false);
  });
});
