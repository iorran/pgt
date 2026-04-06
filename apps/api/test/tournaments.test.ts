import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  createTestApp,
  cleanDb,
  createTestAcademy,
  createTestUser,
  createTestInstructor,
  authHeaders,
  testDb,
} from './helpers';
import * as schema from '../src/db/schema/index.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => {
  app = await createTestApp();
});
beforeEach(async () => {
  await cleanDb();
});

describe('GET /api/tournaments', () => {
  it('lists tournaments for an academy', async () => {
    const academy = await createTestAcademy();
    await testDb.insert(schema.tournament).values({
      academyId: academy.id,
      name: 'Copa Podio',
      date: '2026-07-15',
      location: 'Rio de Janeiro',
      federation: 'IBJJF',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/tournaments?academyId=${academy.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Copa Podio');
    expect(body[0].location).toBe('Rio de Janeiro');
    expect(body[0].federation).toBe('IBJJF');
  });

  it('returns empty array when no tournaments exist', async () => {
    const academy = await createTestAcademy();

    const res = await app.inject({
      method: 'GET',
      url: `/api/tournaments?academyId=${academy.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });
});

describe('POST /api/tournaments', () => {
  it('instructor creates a tournament', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestInstructor(academy.id);

    const res = await app.inject({
      method: 'POST',
      url: '/api/tournaments',
      headers: authHeaders(instructor),
      payload: {
        name: 'Academy Internal',
        date: '2026-08-20',
        location: 'Academy HQ',
        federation: 'Internal',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe('Academy Internal');
    expect(body.date).toBe('2026-08-20');
    expect(body.location).toBe('Academy HQ');
    expect(body.federation).toBe('Internal');
    expect(body.academyId).toBe(academy.id);
  });
});

describe('POST /api/tournaments/:id/signup', () => {
  it('student signs up for a tournament with weight class', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id, { name: 'Fighter' });
    const [tournamentRecord] = await testDb
      .insert(schema.tournament)
      .values({
        academyId: academy.id,
        name: 'Local Open',
        date: '2026-09-10',
        location: 'Sports Arena',
      })
      .returning();

    const res = await app.inject({
      method: 'POST',
      url: `/api/tournaments/${tournamentRecord.id}/signup`,
      headers: authHeaders(student),
      payload: {
        studentId: student.id,
        weightClass: 'Meio-Pesado',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.tournamentId).toBe(tournamentRecord.id);
    expect(body.studentId).toBe(student.id);
    expect(body.weightClass).toBe('Meio-Pesado');
  });
});

describe('GET /api/tournaments/:id/roster', () => {
  it('returns signed-up students with names and belts', async () => {
    const academy = await createTestAcademy();
    const student1 = await createTestUser(academy.id, {
      name: 'Alice',
      belt: 'blue',
    });
    const student2 = await createTestUser(academy.id, {
      name: 'Bob',
      belt: 'purple',
    });

    const [tournamentRecord] = await testDb
      .insert(schema.tournament)
      .values({
        academyId: academy.id,
        name: 'Grand Prix',
        date: '2026-10-05',
        location: 'Main Gym',
      })
      .returning();

    await testDb.insert(schema.tournamentSignup).values([
      {
        tournamentId: tournamentRecord.id,
        studentId: student1.id,
        weightClass: 'Leve',
      },
      {
        tournamentId: tournamentRecord.id,
        studentId: student2.id,
        weightClass: 'Medio',
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/tournaments/${tournamentRecord.id}/roster`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(2);

    const names = body.map((r: any) => r.studentName).sort();
    expect(names).toEqual(['Alice', 'Bob']);

    const alice = body.find((r: any) => r.studentName === 'Alice');
    expect(alice.belt).toBe('blue');
    expect(alice.weightClass).toBe('Leve');
    expect(alice.studentId).toBe(student1.id);
  });

  it('returns empty roster when no signups', async () => {
    const academy = await createTestAcademy();
    const [tournamentRecord] = await testDb
      .insert(schema.tournament)
      .values({
        academyId: academy.id,
        name: 'Empty Tournament',
        date: '2026-11-01',
        location: 'Nowhere',
      })
      .returning();

    const res = await app.inject({
      method: 'GET',
      url: `/api/tournaments/${tournamentRecord.id}/roster`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });

  it('full flow: create tournament, signup, view roster', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestInstructor(academy.id);
    const student = await createTestUser(academy.id, {
      name: 'Carlos',
      belt: 'brown',
    });

    // Instructor creates tournament
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/tournaments',
      headers: authHeaders(instructor),
      payload: {
        name: 'End-to-End Cup',
        date: '2026-12-01',
        location: 'Championship Arena',
        federation: 'CBJJ',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const tournament = createRes.json();

    // Student signs up
    const signupRes = await app.inject({
      method: 'POST',
      url: `/api/tournaments/${tournament.id}/signup`,
      headers: authHeaders(student),
      payload: {
        studentId: student.id,
        weightClass: 'Pesado',
      },
    });
    expect(signupRes.statusCode).toBe(201);

    // View roster
    const rosterRes = await app.inject({
      method: 'GET',
      url: `/api/tournaments/${tournament.id}/roster`,
    });
    expect(rosterRes.statusCode).toBe(200);
    const roster = rosterRes.json();
    expect(roster).toHaveLength(1);
    expect(roster[0].studentName).toBe('Carlos');
    expect(roster[0].belt).toBe('brown');
    expect(roster[0].weightClass).toBe('Pesado');
  });
});
