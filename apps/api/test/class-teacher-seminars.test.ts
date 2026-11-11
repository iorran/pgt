import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  createTestApp,
  cleanDb,
  createTestAcademy,
  createTestUser,
  createTestOwner,
  createTestClass,
  authHeaders,
  testDb,
} from './helpers';
import { checkinToken } from '../src/db/schema/index';
import { isoDateInTz } from '../src/utils/timezone';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  await cleanDb();
});

const TZ = 'Europe/Lisbon';

function isoDaysFromToday(days: number): string {
  return isoDateInTz(new Date(Date.now() + days * 24 * 60 * 60 * 1000), TZ);
}

function weekdayOf(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

async function setup() {
  const acad = await createTestAcademy({ timezone: TZ });
  const owner = await createTestOwner(acad.id, { name: 'Owner Olga' });
  const student = await createTestUser(acad.id, { name: 'Ana Ribeiro', belt: 'black' });
  return { acad, owner, student };
}

function call(method: string, url: string, user: any, payload?: unknown) {
  return app.inject({ method: method as any, url, headers: authHeaders(user), payload: payload as any });
}

const weekly = { name: 'Fundamentos', type: 'gi', recurrence: 'weekly', dayOfWeek: 2, startTime: '19:00', endTime: '20:30' };

async function createSeminar(owner: any, overrides: Record<string, unknown> = {}) {
  const res = await call('POST', '/api/classes', owner, {
    name: 'Passagem de guarda',
    type: 'gi',
    recurrence: 'once',
    date: isoDaysFromToday(5),
    startTime: '10:00',
    endTime: '13:00',
    isSeminar: true,
    studentPrice: 40,
    outsiderPrice: 50,
    guestTeacherName: 'Ricardo Almeida',
    ...overrides,
  });
  expect(res.statusCode).toBe(201);
  return res.json();
}

describe('Class Teacher on classes', () => {
  it('GET /api/classes returns teacher, guest teacher, seminar flag and prices', async () => {
    const { acad, owner, student } = await setup();
    await call('POST', '/api/classes', owner, { ...weekly, teacherId: student.id });

    const res = await call('GET', `/api/classes?academyId=${acad.id}`, owner);
    expect(res.statusCode).toBe(200);
    const [cls] = res.json();
    expect(cls.teacher).toEqual({ id: student.id, name: 'Ana Ribeiro', belt: 'black' });
    expect(cls.guestTeacherName).toBeNull();
    expect(cls.isSeminar).toBe(false);
    expect(cls.studentPrice).toBeNull();
    expect(cls.outsiderPrice).toBeNull();
    expect(cls.recurrence).toBe('weekly');
  });

  it('a class without teacher returns teacher null', async () => {
    const { acad, owner } = await setup();
    await call('POST', '/api/classes', owner, weekly);
    const [cls] = (await call('GET', `/api/classes?academyId=${acad.id}`, owner)).json();
    expect(cls.teacher).toBeNull();
  });

  it('rejects a teacher from another academy', async () => {
    const { owner } = await setup();
    const other = await createTestAcademy();
    const stranger = await createTestUser(other.id);
    const res = await call('POST', '/api/classes', owner, { ...weekly, teacherId: stranger.id });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('INVALID_TEACHER');
  });

  it('the owner can be the teacher', async () => {
    const { owner } = await setup();
    const res = await call('POST', '/api/classes', owner, { ...weekly, teacherId: owner.id });
    expect(res.statusCode).toBe(201);
  });

  it('guest teacher only on seminars', async () => {
    const { owner } = await setup();
    const res = await call('POST', '/api/classes', owner, { ...weekly, guestTeacherName: 'Ricardo' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('GUEST_TEACHER_SEMINAR_ONLY');
  });

  it('PUT sets and clears the teacher', async () => {
    const { acad, owner, student } = await setup();
    const cls = (await call('POST', '/api/classes', owner, weekly)).json();

    let res = await call('PUT', `/api/classes/${cls.id}`, owner, { teacherId: student.id });
    expect(res.statusCode).toBe(200);
    let [listed] = (await call('GET', `/api/classes?academyId=${acad.id}`, owner)).json();
    expect(listed.teacher.id).toBe(student.id);

    res = await call('PUT', `/api/classes/${cls.id}`, owner, { teacherId: null });
    expect(res.statusCode).toBe(200);
    [listed] = (await call('GET', `/api/classes?academyId=${acad.id}`, owner)).json();
    expect(listed.teacher).toBeNull();
  });

  it('PUT rejects a teacher from another academy', async () => {
    const { owner } = await setup();
    const cls = (await call('POST', '/api/classes', owner, weekly)).json();
    const stranger = await createTestUser((await createTestAcademy()).id);
    const res = await call('PUT', `/api/classes/${cls.id}`, owner, { teacherId: stranger.id });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('INVALID_TEACHER');
  });
});

describe('One-off classes', () => {
  it('requires a date', async () => {
    const { owner } = await setup();
    const res = await call('POST', '/api/classes', owner, { ...weekly, recurrence: 'once', dayOfWeek: undefined });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('DATE_REQUIRED');
  });

  it('derives the weekday from the date', async () => {
    const { owner } = await setup();
    const date = isoDaysFromToday(3);
    const res = await call('POST', '/api/classes', owner, { ...weekly, recurrence: 'once', dayOfWeek: undefined, date });
    expect(res.statusCode).toBe(201);
    expect(res.json().dayOfWeek).toBe(weekdayOf(date));
    expect(res.json().date).toBe(date);
  });

  it('PUT with a new date re-derives the weekday', async () => {
    const { owner } = await setup();
    const cls = (await call('POST', '/api/classes', owner, { ...weekly, recurrence: 'once', date: isoDaysFromToday(3) })).json();
    const date = isoDaysFromToday(4);
    const res = await call('PUT', `/api/classes/${cls.id}`, owner, { date });
    expect(res.statusCode).toBe(200);
    expect(res.json().dayOfWeek).toBe(weekdayOf(date));
  });

  it('a one-off class happening now accepts a QR check-in', async () => {
    const { acad, owner, student } = await setup();
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    const hour = Math.min(Number(parts.slice(0, 2)), 22);
    const cls = await createTestClass(acad.id, {
      instructorId: owner.id,
      recurrence: 'once',
      date: isoDateInTz(now, TZ),
      dayOfWeek: null,
      startTime: `${String(hour).padStart(2, '0')}:00`,
      endTime: `${String(hour + 1).padStart(2, '0')}:00`,
    });
    const token = crypto.randomUUID();
    await testDb.insert(checkinToken).values({ classId: cls.id, token, expiresAt: new Date(Date.now() + 5 * 60 * 1000) });

    const res = await call('POST', '/api/checkins', student, { classId: cls.id, source: 'qr', token });
    expect(res.statusCode).toBe(201);
  });
});

describe('Seminars', () => {
  it('creates a seminar with prices and a guest teacher', async () => {
    const { acad, owner } = await setup();
    await createSeminar(owner);
    const [cls] = (await call('GET', `/api/classes?academyId=${acad.id}`, owner)).json();
    expect(cls.isSeminar).toBe(true);
    expect(cls.guestTeacherName).toBe('Ricardo Almeida');
    expect(cls.studentPrice).toBe('40.00');
    expect(cls.outsiderPrice).toBe('50.00');
    expect(cls.recurrence).toBe('once');
  });

  it('must be a one-off class', async () => {
    const { owner } = await setup();
    const res = await call('POST', '/api/classes', owner, { ...weekly, isSeminar: true, studentPrice: 40, outsiderPrice: 50 });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('SEMINAR_MUST_BE_ONCE');
  });

  it('needs both prices', async () => {
    const { owner } = await setup();
    const res = await call('POST', '/api/classes', owner, {
      ...weekly, recurrence: 'once', date: isoDaysFromToday(2), isSeminar: true, studentPrice: 40,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('SEMINAR_PRICE_REQUIRED');
  });

  it('cannot have both a student teacher and a guest teacher', async () => {
    const { owner, student } = await setup();
    const res = await call('POST', '/api/classes', owner, {
      ...weekly, recurrence: 'once', date: isoDaysFromToday(2), isSeminar: true, studentPrice: 40, outsiderPrice: 50,
      teacherId: student.id, guestTeacherName: 'Ricardo',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('ONE_TEACHER_ONLY');
  });

  it('PUT updates prices but never the seminar flag', async () => {
    const { acad, owner } = await setup();
    const sem = await createSeminar(owner);
    const res = await call('PUT', `/api/classes/${sem.id}`, owner, { studentPrice: 35, isSeminar: false });
    expect(res.statusCode).toBe(200);
    const [cls] = (await call('GET', `/api/classes?academyId=${acad.id}`, owner)).json();
    expect(cls.isSeminar).toBe(true);
    expect(cls.studentPrice).toBe('35.00');
  });
});

describe('GET /api/teachers/candidates', () => {
  it('lists active students and the owner, by name, for the owner only', async () => {
    const { acad, owner } = await setup();
    await createTestUser(acad.id, { name: 'Bruno Costa', belt: 'brown' });
    await createTestUser(acad.id, { name: 'Zé Pendente', status: 'pending' });
    await createTestUser((await createTestAcademy()).id, { name: 'Outro' });

    const res = await call('GET', '/api/teachers/candidates', owner);
    expect(res.statusCode).toBe(200);
    expect(res.json().map((c: any) => c.name)).toEqual(['Ana Ribeiro', 'Bruno Costa', 'Owner Olga']);
    expect(res.json()[1]).toEqual(expect.objectContaining({ belt: 'brown', role: 'student' }));
  });

  it('is owner only', async () => {
    const { student } = await setup();
    expect((await call('GET', '/api/teachers/candidates', student)).statusCode).toBe(403);
  });
});

describe('Seminar participants (owner)', () => {
  it('adds a student and an outsider with default prices, lists them by name', async () => {
    const { owner, student } = await setup();
    const sem = await createSeminar(owner);

    const a = await call('POST', `/api/seminars/${sem.id}/participants`, owner, { studentId: student.id });
    expect(a.statusCode).toBe(201);
    const b = await call('POST', `/api/seminars/${sem.id}/participants`, owner, { name: 'Marta Sousa', phone: '912345678' });
    expect(b.statusCode).toBe(201);

    const res = await call('GET', `/api/seminars/${sem.id}/participants`, owner);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      expect.objectContaining({ kind: 'student', studentId: student.id, name: 'Ana Ribeiro', amount: '40.00', paidAt: null, phone: null }),
      expect.objectContaining({ kind: 'outsider', studentId: null, name: 'Marta Sousa', phone: '912345678', amount: '50.00', paidAt: null }),
    ]);
  });

  it('accepts an amount override', async () => {
    const { owner, student } = await setup();
    const sem = await createSeminar(owner);
    const res = await call('POST', `/api/seminars/${sem.id}/participants`, owner, { studentId: student.id, amount: 0 });
    expect(res.statusCode).toBe(201);
    expect(res.json().amount).toBe('0.00');
  });

  it('rejects a duplicate student, a student from elsewhere and a nameless outsider', async () => {
    const { owner, student } = await setup();
    const sem = await createSeminar(owner);
    await call('POST', `/api/seminars/${sem.id}/participants`, owner, { studentId: student.id });

    const dup = await call('POST', `/api/seminars/${sem.id}/participants`, owner, { studentId: student.id });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error).toBe('ALREADY_PARTICIPANT');

    const stranger = await createTestUser((await createTestAcademy()).id);
    const bad = await call('POST', `/api/seminars/${sem.id}/participants`, owner, { studentId: stranger.id });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error).toBe('INVALID_STUDENT');

    const noName = await call('POST', `/api/seminars/${sem.id}/participants`, owner, { name: '  ' });
    expect(noName.statusCode).toBe(400);
    expect(noName.json().error).toBe('NAME_REQUIRED');
  });

  it('404 for a class that is not a seminar or belongs to another academy', async () => {
    const { owner } = await setup();
    const cls = (await call('POST', '/api/classes', owner, weekly)).json();
    const res = await call('GET', `/api/seminars/${cls.id}/participants`, owner);
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('SEMINAR_NOT_FOUND');

    const otherOwner = await createTestOwner((await createTestAcademy()).id);
    const sem = await createSeminar(owner);
    expect((await call('GET', `/api/seminars/${sem.id}/participants`, otherOwner)).statusCode).toBe(404);
  });

  it('marks paid with today, unmarks, edits the amount and removes', async () => {
    const { owner } = await setup();
    const sem = await createSeminar(owner);
    const p = (await call('POST', `/api/seminars/${sem.id}/participants`, owner, { name: 'Marta' })).json();

    let res = await call('PATCH', `/api/seminar-participants/${p.id}`, owner, { paid: true, amount: 45 });
    expect(res.statusCode).toBe(200);
    expect(res.json().paidAt).toBe(isoDateInTz(new Date(), TZ));
    expect(res.json().amount).toBe('45.00');

    res = await call('PATCH', `/api/seminar-participants/${p.id}`, owner, { paid: false });
    expect(res.json().paidAt).toBeNull();

    res = await call('DELETE', `/api/seminar-participants/${p.id}`, owner);
    expect(res.statusCode).toBe(204);
    expect((await call('GET', `/api/seminars/${sem.id}/participants`, owner)).json()).toHaveLength(0);
  });

  it('another academy cannot touch a participant', async () => {
    const { owner } = await setup();
    const sem = await createSeminar(owner);
    const p = (await call('POST', `/api/seminars/${sem.id}/participants`, owner, { name: 'Marta' })).json();
    const otherOwner = await createTestOwner((await createTestAcademy()).id);
    expect((await call('PATCH', `/api/seminar-participants/${p.id}`, otherOwner, { paid: true })).statusCode).toBe(404);
    expect((await call('DELETE', `/api/seminar-participants/${p.id}`, otherOwner)).statusCode).toBe(404);
  });

  it('students cannot manage participants', async () => {
    const { owner, student } = await setup();
    const sem = await createSeminar(owner);
    expect((await call('GET', `/api/seminars/${sem.id}/participants`, student)).statusCode).toBe(403);
  });
});

describe('GET /api/seminars (owner list)', () => {
  it('lists active seminars by date with participant and money totals', async () => {
    const { owner, student } = await setup();
    const later = await createSeminar(owner, { name: 'Leg locks', date: isoDaysFromToday(25), guestTeacherName: null, teacherId: student.id });
    const sem = await createSeminar(owner);
    const gone = await createSeminar(owner, { name: 'Apagado' });
    await call('DELETE', `/api/classes/${gone.id}`, owner);
    await call('POST', '/api/classes', owner, weekly);
    const paid = (await call('POST', `/api/seminars/${sem.id}/participants`, owner, { studentId: student.id })).json();
    await call('POST', `/api/seminars/${sem.id}/participants`, owner, { name: 'Marta' });
    await call('PATCH', `/api/seminar-participants/${paid.id}`, owner, { paid: true });

    const res = await call('GET', '/api/seminars', owner);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      {
        classId: sem.id, name: 'Passagem de guarda', date: sem.date, startTime: '10:00:00', endTime: '13:00:00',
        teacher: null, guestTeacherName: 'Ricardo Almeida',
        participants: 2, paidCount: 1, received: '40.00', pending: '50.00',
      },
      {
        classId: later.id, name: 'Leg locks', date: later.date, startTime: '10:00:00', endTime: '13:00:00',
        teacher: { id: student.id, name: 'Ana Ribeiro', belt: 'black' }, guestTeacherName: null,
        participants: 0, paidCount: 0, received: '0.00', pending: '0.00',
      },
    ]);
  });

  it('is owner only and scoped to the academy', async () => {
    const { owner, student } = await setup();
    await createSeminar(owner);
    expect((await call('GET', '/api/seminars', student)).statusCode).toBe(403);
    const otherOwner = await createTestOwner((await createTestAcademy()).id);
    expect((await call('GET', '/api/seminars', otherOwner)).json()).toEqual([]);
  });
});

describe('Seminar sign-up (student)', () => {
  it('signs up pending at the student price, shows in mine, and cancels', async () => {
    const { owner, student } = await setup();
    const sem = await createSeminar(owner);

    const res = await call('POST', `/api/seminars/${sem.id}/signup`, student);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual(expect.objectContaining({ amount: '40.00', paidAt: null }));

    const dup = await call('POST', `/api/seminars/${sem.id}/signup`, student);
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error).toBe('ALREADY_PARTICIPANT');

    const mine = await call('GET', '/api/seminars/mine', student);
    expect(mine.statusCode).toBe(200);
    expect(mine.json()).toEqual([
      expect.objectContaining({
        classId: sem.id, name: 'Passagem de guarda', date: sem.date, startTime: '10:00:00', endTime: '13:00:00',
        teacher: null, guestTeacherName: 'Ricardo Almeida', amount: '40.00', paidAt: null,
      }),
    ]);

    expect((await call('DELETE', `/api/seminars/${sem.id}/signup`, student)).statusCode).toBe(204);
    expect((await call('GET', '/api/seminars/mine', student)).json()).toHaveLength(0);
    expect((await call('DELETE', `/api/seminars/${sem.id}/signup`, student)).statusCode).toBe(404);
  });

  it('cannot cancel once paid', async () => {
    const { owner, student } = await setup();
    const sem = await createSeminar(owner);
    const p = (await call('POST', `/api/seminars/${sem.id}/signup`, student)).json();
    await call('PATCH', `/api/seminar-participants/${p.id}`, owner, { paid: true });

    const res = await call('DELETE', `/api/seminars/${sem.id}/signup`, student);
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('SEMINAR_ALREADY_PAID');
  });

  it('cannot sign up to a past seminar', async () => {
    const { owner, student } = await setup();
    const sem = await createSeminar(owner, { date: isoDaysFromToday(-2) });
    const res = await call('POST', `/api/seminars/${sem.id}/signup`, student);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('SEMINAR_PAST');
  });

  it('404 for a normal class or another academy', async () => {
    const { owner, student } = await setup();
    const cls = (await call('POST', '/api/classes', owner, weekly)).json();
    expect((await call('POST', `/api/seminars/${cls.id}/signup`, student)).statusCode).toBe(404);

    const otherOwner = await createTestOwner((await createTestAcademy()).id);
    const sem = await createSeminar(otherOwner);
    expect((await call('POST', `/api/seminars/${sem.id}/signup`, student)).statusCode).toBe(404);
  });
});

describe('Totem tokens carry the teacher', () => {
  it('includes teacher, guest teacher and seminar flag', async () => {
    const { acad, owner, student } = await setup();
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false, weekday: 'short' }).formatToParts(now);
    const hour = Math.min(Number(parts.find((p) => p.type === 'hour')!.value) % 24, 22);
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    await createTestClass(acad.id, {
      instructorId: owner.id,
      teacherId: student.id,
      dayOfWeek: map[parts.find((p) => p.type === 'weekday')!.value],
      startTime: `${String(hour).padStart(2, '0')}:00`,
      endTime: `${String(hour + 1).padStart(2, '0')}:00`,
    });

    const res = await call('GET', '/api/checkins/tokens', owner);
    expect(res.statusCode).toBe(200);
    expect(res.json()[0]).toEqual(expect.objectContaining({
      teacher: { name: 'Ana Ribeiro', belt: 'black' },
      guestTeacherName: null,
      isSeminar: false,
    }));
  });
});
