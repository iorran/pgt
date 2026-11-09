import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { eq, like } from 'drizzle-orm';
import { createTestApp, cleanDb, createTestAcademy, createTestUser, createTestOwner, authHeaders, testDb } from './helpers';
import * as schema from '../src/db/schema/index';
import { auth } from '../src/auth/index';
import { emailService } from '../src/email/index';
import type { FastifyInstance } from 'fastify';

// Spec: docs/superpowers/specs/2026-11-07-family-account-profiles-design.md (ADR 0004)

let app: FastifyInstance;
beforeAll(async () => { app = await createTestApp(); });
beforeEach(async () => { await cleanDb(); });

async function setup() {
  const academy = await createTestAcademy();
  const owner = await createTestOwner(academy.id);
  const student = (name: string, extra: Partial<typeof schema.user.$inferInsert> = {}) =>
    createTestUser(academy.id, { name, ...extra });

  // Família Costa: Rafael trains and is the Responsible; Karina and Livia are Dependents.
  const rafael = await student('Rafael Costa', { phone: '911111111' });
  const karina = await student('Karina Costa');
  const livia = await student('Livia Costa');
  const [costa] = await testDb.insert(schema.family).values({ academyId: academy.id, name: 'Costa', responsibleUserId: rafael.id }).returning();
  await testDb.update(schema.user).set({ familyId: costa.id }).where(eq(schema.user.academyId, academy.id));
  await testDb.update(schema.user).set({ familyId: null }).where(eq(schema.user.id, owner.id));

  // Família Lima: Paula doesn't train (role responsible, not a member); Alice and Afonso.
  const paula = await createTestUser(academy.id, { name: 'Paula Lima', role: 'responsible', phone: '922222222' });
  const [lima] = await testDb.insert(schema.family).values({ academyId: academy.id, name: 'Lima', responsibleUserId: paula.id }).returning();
  const alice = await student('Alice Lima', { familyId: lima.id });
  const afonso = await student('Afonso Lima', { familyId: lima.id });

  const solo = await student('Solo Student');

  const as = (user: { id: string; role: string; academyId: string | null }, actingAs?: string) => ({
    ...authHeaders(user),
    ...(actingAs ? { 'x-acting-as': actingAs } : {}),
  });
  const api = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, headers: object, payload?: object) =>
    app.inject({ method, url, headers: headers as any, payload });

  return { academy, owner, rafael, karina, livia, costa, paula, lima, alice, afonso, solo, student, as, api };
}

describe('acting as a Dependent (x-acting-as)', () => {
  it('the Responsible acts as their Dependent; the real user stays the actor', async () => {
    const { rafael, livia, as, api } = await setup();
    const res = await api('GET', '/api/me/profiles', as(rafael, livia.id));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ actorId: rafael.id, currentId: livia.id });
  });

  it('without the header the user is themself', async () => {
    const { rafael, as, api } = await setup();
    const res = await api('GET', '/api/me/profiles', as(rafael));
    expect(res.json()).toMatchObject({ actorId: rafael.id, currentId: rafael.id });
  });

  it('acting as yourself is a no-op', async () => {
    const { rafael, as, api } = await setup();
    const res = await api('GET', '/api/me/profiles', as(rafael, rafael.id));
    expect(res.statusCode).toBe(200);
    expect(res.json().currentId).toBe(rafael.id);
  });

  it('403 for someone else\'s Dependent, for a non-member, and for the Owner', async () => {
    const { rafael, owner, alice, livia, solo, as, api } = await setup();
    expect((await api('GET', '/api/me/profiles', as(rafael, alice.id))).statusCode).toBe(403);
    expect((await api('GET', '/api/me/profiles', as(rafael, solo.id))).statusCode).toBe(403);
    expect((await api('GET', '/api/me/profiles', as(owner, livia.id))).statusCode).toBe(403);
  });

  it('a Dependent cannot act as the Responsible or a sibling', async () => {
    const { karina, rafael, livia, as, api } = await setup();
    expect((await api('GET', '/api/me/profiles', as(karina, rafael.id))).statusCode).toBe(403);
    expect((await api('GET', '/api/me/profiles', as(karina, livia.id))).statusCode).toBe(403);
  });

  it('403 when the family was deleted', async () => {
    const { rafael, livia, costa, as, api } = await setup();
    await testDb.update(schema.family).set({ deletedAt: new Date() }).where(eq(schema.family.id, costa.id));
    expect((await api('GET', '/api/me/profiles', as(rafael, livia.id))).statusCode).toBe(403);
  });

  it('student endpoints answer for the Dependent (my-status)', async () => {
    const { rafael, livia, as, api } = await setup();
    await testDb.insert(schema.studentMembership).values({ studentId: livia.id, monthlyFee: '35.00', startDate: '2020-01-01', dueDay: 1 });
    const acting = await api('GET', '/api/payments/my-status', as(rafael, livia.id));
    const direct = await api('GET', '/api/payments/my-status', as(livia));
    const self = await api('GET', '/api/payments/my-status', as(rafael));
    expect(acting.statusCode).toBe(200);
    expect(acting.json()).toEqual(direct.json());
    expect(acting.json().status).toBe('overdue');
    expect(self.json().status).toBe('ok');
  });
});

describe('GET /api/me/profiles', () => {
  it('a Responsible who trains: self + Dependents', async () => {
    const { rafael, karina, livia, as, api } = await setup();
    const body = (await api('GET', '/api/me/profiles', as(rafael))).json();
    expect(body.self).toMatchObject({ id: rafael.id, name: 'Rafael Costa' });
    expect(body.dependents.map((d: any) => d.id)).toEqual([karina.id, livia.id]);
  });

  it('a Responsible who doesn\'t train: no self, only Dependents', async () => {
    const { paula, alice, afonso, as, api } = await setup();
    const body = (await api('GET', '/api/me/profiles', as(paula))).json();
    expect(body.self).toBeNull();
    expect(body.dependents.map((d: any) => d.id)).toEqual([afonso.id, alice.id]);
  });

  it('a student outside any family: self, no Dependents', async () => {
    const { solo, as, api } = await setup();
    const body = (await api('GET', '/api/me/profiles', as(solo))).json();
    expect(body.self.id).toBe(solo.id);
    expect(body.dependents).toEqual([]);
  });

  it('a Dependent has no Dependents', async () => {
    const { karina, as, api } = await setup();
    expect((await api('GET', '/api/me/profiles', as(karina))).json().dependents).toEqual([]);
  });
});

describe('Owner manages the Responsible', () => {
  it('creating a family requires a Responsible', async () => {
    const { owner, student, as, api } = await setup();
    const a = await student('A');
    const res = await api('POST', '/api/families', as(owner), { name: 'F', memberIds: [a.id] });
    expect(res.statusCode).toBe(400);
  });

  it('creates with a member as Responsible', async () => {
    const { owner, student, as, api } = await setup();
    const a = await student('A');
    const b = await student('B');
    const res = await api('POST', '/api/families', as(owner), { name: 'F', memberIds: [a.id, b.id], responsibleId: b.id });
    expect(res.statusCode).toBe(201);
    expect(res.json().responsible).toMatchObject({ id: b.id, name: 'B', trains: true });
  });

  it('rejects a Responsible who is not a member', async () => {
    const { owner, student, solo, as, api } = await setup();
    const a = await student('A');
    const res = await api('POST', '/api/families', as(owner), { name: 'F', memberIds: [a.id], responsibleId: solo.id });
    expect(res.statusCode).toBe(400);
  });

  it('creates with a new non-training Responsible (role responsible, not a member)', async () => {
    const { owner, academy, student, as, api } = await setup();
    const kid = await student('Kid');
    const res = await api('POST', '/api/families', as(owner), {
      name: 'F', memberIds: [kid.id], responsible: { name: 'Mãe', email: 'MAE@example.com' },
    });
    expect(res.statusCode).toBe(201);
    const [mae] = await testDb.select().from(schema.user).where(eq(schema.user.email, 'mae@example.com'));
    expect(mae).toMatchObject({ role: 'responsible', academyId: academy.id, familyId: null, name: 'Mãe' });
    expect(res.json().responsible).toMatchObject({ id: mae.id, trains: false });
  });

  it('409 when the new Responsible email is already used', async () => {
    const { owner, student, rafael, as, api } = await setup();
    const kid = await student('Kid');
    const res = await api('POST', '/api/families', as(owner), {
      name: 'F', memberIds: [kid.id], responsible: { name: 'X', email: rafael.email },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('EMAIL_TAKEN');
  });

  it('changes the Responsible to another member or a new person', async () => {
    const { owner, costa, karina, as, api } = await setup();
    const res = await api('PUT', `/api/families/${costa.id}/responsible`, as(owner), { userId: karina.id });
    expect(res.statusCode).toBe(200);
    expect(res.json().responsible.id).toBe(karina.id);

    const res2 = await api('PUT', `/api/families/${costa.id}/responsible`, as(owner), { name: 'Avó', email: 'avo@example.com' });
    expect(res2.statusCode).toBe(200);
    expect(res2.json().responsible).toMatchObject({ name: 'Avó', trains: false });
  });

  it('a person is Responsible of at most one family', async () => {
    const { owner, lima, rafael, as, api } = await setup();
    const res = await api('PUT', `/api/families/${lima.id}/responsible`, as(owner), { userId: rafael.id });
    expect(res.statusCode).toBe(400); // not a member of Lima
  });

  it('cannot remove the Responsible from the family', async () => {
    const { owner, costa, rafael, as, api } = await setup();
    const res = await api('DELETE', `/api/families/${costa.id}/members/${rafael.id}`, as(owner));
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('RESPONSIBLE_REQUIRED');
  });

  it('removing a Dependent with an email lets them log in alone later', async () => {
    const { owner, costa, livia, as, api } = await setup();
    const res = await api('DELETE', `/api/families/${costa.id}/members/${livia.id}`, as(owner), { email: 'Livia@Example.com' });
    expect(res.statusCode).toBe(200);
    const [row] = await testDb.select().from(schema.user).where(eq(schema.user.id, livia.id));
    expect(row).toMatchObject({ familyId: null, email: 'livia@example.com' });
  });

  it('removal validates the email', async () => {
    const { owner, costa, livia, karina, rafael, as, api } = await setup();
    expect((await api('DELETE', `/api/families/${costa.id}/members/${livia.id}`, as(owner), { email: 'nope' })).statusCode).toBe(400);
    const taken = await api('DELETE', `/api/families/${costa.id}/members/${karina.id}`, as(owner), { email: rafael.email });
    expect(taken.statusCode).toBe(409);
    expect(taken.json().error).toBe('EMAIL_TAKEN');
  });

  it('only the Owner manages families — the Responsible gets 403', async () => {
    const { costa, rafael, livia, as, api } = await setup();
    expect((await api('DELETE', `/api/families/${costa.id}/members/${livia.id}`, as(rafael))).statusCode).toBe(403);
    expect((await api('PUT', `/api/families/${costa.id}/responsible`, as(rafael), { userId: livia.id })).statusCode).toBe(403);
  });

  it('invite sends a set-password link to the Responsible', async () => {
    const { owner, lima, paula, as, api } = await setup();
    const spy = vi.spyOn(emailService, 'sendPasswordReset').mockResolvedValue();
    const res = await api('POST', `/api/families/${lima.id}/responsible/invite`, as(owner));
    expect(res.statusCode).toBe(204);
    expect(spy).toHaveBeenCalledWith(paula.email, expect.stringContaining('/reset-password'));
    spy.mockRestore();
  });
});

describe('logins', () => {
  async function withPassword(email: string) {
    await auth.api.signUpEmail({ body: { email, password: 'secret-123', name: email } });
    const [u] = await testDb.select().from(schema.user).where(eq(schema.user.email, email));
    return u;
  }

  it('a Dependent cannot sign in; the Responsible can', async () => {
    const { academy } = await setup();
    const resp = await withPassword('resp@example.com');
    const dep = await withPassword('dep@example.com');
    const [fam] = await testDb.insert(schema.family).values({ academyId: academy.id, name: 'X', responsibleUserId: resp.id }).returning();
    await testDb.update(schema.user).set({ academyId: academy.id, familyId: fam.id }).where(eq(schema.user.id, dep.id));
    await testDb.update(schema.user).set({ academyId: academy.id, familyId: fam.id }).where(eq(schema.user.id, resp.id));

    await expect(auth.api.signInEmail({ body: { email: 'dep@example.com', password: 'secret-123' } })).rejects.toThrow();
    await expect(auth.api.signInEmail({ body: { email: 'resp@example.com', password: 'secret-123' } })).resolves.toBeTruthy();
  });

  it('scenario 7: removed from the family with an email, she creates her login alone (Primeiro acesso)', async () => {
    const { owner, costa, livia, as, api } = await setup();
    const removed = await api('DELETE', `/api/families/${costa.id}/members/${livia.id}`, as(owner), { email: 'livia@example.com' });
    expect(removed.statusCode).toBe(200);

    await auth.api.requestPasswordReset({ body: { email: 'livia@example.com', redirectTo: 'http://localhost:5173/reset-password' } });
    const [v] = await testDb.select().from(schema.verification).where(like(schema.verification.identifier, 'reset-password:%'));
    const token = v.identifier.split(':')[1];
    await auth.api.resetPassword({ body: { token, newPassword: 'nova-senha-1' } });
    await expect(auth.api.signInEmail({ body: { email: 'livia@example.com', password: 'nova-senha-1' } })).resolves.toBeTruthy();
  });

  it('while still a Dependent, a reset link does not let her in', async () => {
    const { livia } = await setup();
    await auth.api.requestPasswordReset({ body: { email: livia.email, redirectTo: 'http://localhost:5173/reset-password' } });
    const [v] = await testDb.select().from(schema.verification).where(like(schema.verification.identifier, 'reset-password:%'));
    await auth.api.resetPassword({ body: { token: v.identifier.split(':')[1], newPassword: 'nova-senha-1' } });
    await expect(auth.api.signInEmail({ body: { email: livia.email, password: 'nova-senha-1' } })).rejects.toThrow();
  });
});

describe('billing mail and contact go to the Responsible', () => {
  it('overdue notify for a Dependent emails the Responsible', async () => {
    const { owner, paula, alice, as, api } = await setup();
    await testDb.insert(schema.studentMembership).values({ studentId: alice.id, monthlyFee: '35.00', startDate: '2020-01-01', dueDay: 1 });
    const spy = vi.spyOn(emailService, 'sendOverduePayment').mockResolvedValue();
    const res = await api('POST', `/api/payments/overdue/${alice.id}/notify`, as(owner));
    expect(res.statusCode).toBe(200);
    expect(spy).toHaveBeenCalledWith(paula.email, 'Alice Lima', expect.any(String), expect.any(Number));
    spy.mockRestore();
  });

  it('family overdue card uses the Responsible\'s phone', async () => {
    const { owner, alice, afonso, as, api } = await setup();
    for (const s of [alice, afonso]) {
      await testDb.insert(schema.studentMembership).values({ studentId: s.id, monthlyFee: '35.00', startDate: '2020-01-01', dueDay: 1 });
    }
    const res = await api('GET', '/api/payments/overdue', as(owner));
    const card = res.json().find((i: any) => i.kind === 'family');
    expect(card.phone).toBe('922222222');
  });
});
