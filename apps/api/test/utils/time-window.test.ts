import { describe, it, expect, vi, afterEach } from 'vitest';
import { isClassActiveNow } from '../../src/utils/time-window';

describe('isClassActiveNow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('academy timezone awareness', () => {
    it('uses academy TZ, not server TZ, to decide whether a class is active', () => {
      // class runs 19:00-20:00 Lisbon. At 2026-04-23T18:50:00Z (= 19:50 Lisbon in DST/WEST) it's active.
      const cls = {
        recurrence: 'weekly',
        dayOfWeek: 4, // 2026-04-23 is a Thursday
        date: null,
        startTime: '19:00',
        endTime: '20:00',
      };
      const at = new Date('2026-04-23T18:50:00Z');
      expect(isClassActiveNow(cls, 'Europe/Lisbon', at)).toBe(true);
      // Same instant is 15:50 Sao Paulo -> before 19:00 class -> not active.
      expect(isClassActiveNow(cls, 'America/Sao_Paulo', at)).toBe(false);
    });

    it('respects the 15-min pre-window and 60-min post-window', () => {
      const cls = {
        recurrence: 'weekly',
        dayOfWeek: 4, // 2026-04-23 is Thursday in Lisbon
        date: null,
        startTime: '19:00',
        endTime: '20:00',
      };
      // 18:44 Lisbon -> outside pre-window (15 min before 19:00 = 18:45).
      // Lisbon in April is WEST (UTC+1), so 18:44 Lisbon == 17:44 UTC.
      expect(isClassActiveNow(cls, 'Europe/Lisbon', new Date('2026-04-23T17:44:00Z'))).toBe(false);
      // 18:46 Lisbon -> inside pre-window
      expect(isClassActiveNow(cls, 'Europe/Lisbon', new Date('2026-04-23T17:46:00Z'))).toBe(true);
      // 21:00 Lisbon -> exactly 60min past end, inside window
      expect(isClassActiveNow(cls, 'Europe/Lisbon', new Date('2026-04-23T20:00:00Z'))).toBe(true);
      // 21:01 Lisbon -> just outside
      expect(isClassActiveNow(cls, 'Europe/Lisbon', new Date('2026-04-23T20:01:00Z'))).toBe(false);
    });
  });

  describe('weekly recurrence day-of-week matching (in academy TZ)', () => {
    it('returns true during class time on the right day', () => {
      // 2026-04-06 is Monday. 07:30 Lisbon == 06:30 UTC (WEST, UTC+1).
      expect(isClassActiveNow({
        recurrence: 'weekly',
        dayOfWeek: 1,
        date: null,
        startTime: '07:00',
        endTime: '08:30',
      }, 'Europe/Lisbon', new Date('2026-04-06T06:30:00Z'))).toBe(true);
    });

    it('returns true 15 minutes before start', () => {
      // 06:45 Lisbon == 05:45 UTC
      expect(isClassActiveNow({
        recurrence: 'weekly',
        dayOfWeek: 1,
        date: null,
        startTime: '07:00',
        endTime: '08:30',
      }, 'Europe/Lisbon', new Date('2026-04-06T05:45:00Z'))).toBe(true);
    });

    it('returns true 1 hour after end', () => {
      // 09:29 Lisbon == 08:29 UTC
      expect(isClassActiveNow({
        recurrence: 'weekly',
        dayOfWeek: 1,
        date: null,
        startTime: '07:00',
        endTime: '08:30',
      }, 'Europe/Lisbon', new Date('2026-04-06T08:29:00Z'))).toBe(true);
    });

    it('returns false 16 minutes before start', () => {
      // 06:44 Lisbon == 05:44 UTC
      expect(isClassActiveNow({
        recurrence: 'weekly',
        dayOfWeek: 1,
        date: null,
        startTime: '07:00',
        endTime: '08:30',
      }, 'Europe/Lisbon', new Date('2026-04-06T05:44:00Z'))).toBe(false);
    });

    it('returns false more than 1 hour after end', () => {
      // 09:31 Lisbon == 08:31 UTC
      expect(isClassActiveNow({
        recurrence: 'weekly',
        dayOfWeek: 1,
        date: null,
        startTime: '07:00',
        endTime: '08:30',
      }, 'Europe/Lisbon', new Date('2026-04-06T08:31:00Z'))).toBe(false);
    });

    it('returns false on wrong day of week', () => {
      // 2026-04-07 is Tuesday, but class is dayOfWeek=1 (Monday). 07:30 Lisbon == 06:30 UTC.
      expect(isClassActiveNow({
        recurrence: 'weekly',
        dayOfWeek: 1,
        date: null,
        startTime: '07:00',
        endTime: '08:30',
      }, 'Europe/Lisbon', new Date('2026-04-07T06:30:00Z'))).toBe(false);
    });
  });

  describe('one-time class by date (in academy TZ)', () => {
    it('handles one-time class by date', () => {
      // 2026-04-10 10:00 Lisbon == 09:00 UTC
      expect(isClassActiveNow({
        recurrence: 'once',
        dayOfWeek: null,
        date: '2026-04-10',
        startTime: '09:30',
        endTime: '11:00',
      }, 'Europe/Lisbon', new Date('2026-04-10T09:00:00Z'))).toBe(true);
    });

    it('returns false for one-time class on wrong date', () => {
      // 2026-04-11 10:00 Lisbon == 09:00 UTC, but class date is 2026-04-10
      expect(isClassActiveNow({
        recurrence: 'once',
        dayOfWeek: null,
        date: '2026-04-10',
        startTime: '09:30',
        endTime: '11:00',
      }, 'Europe/Lisbon', new Date('2026-04-11T09:00:00Z'))).toBe(false);
    });
  });
});
