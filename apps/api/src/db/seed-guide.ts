import { eq, inArray, sql } from 'drizzle-orm';
import { db as defaultDb } from './client.js';
import * as schema from './schema/index.js';

// Canonical constants — change these and every screenshot will reseed deterministically.
export const DEMO_ACADEMY_SLUG = 'demo-pgt';
export const DEMO_ACADEMY_NAME = 'Academia Demo PGT';
export const DEMO_ACADEMY_CITY = 'Lisboa';
export const DEMO_JOIN_CODE = 'PGT-DEMO-001';

export const DEMO_INSTRUCTOR_EMAIL = 'instrutor@demo.pgt';
export const DEMO_PASSWORD = 'demo-pgt-2026';

export const DEMO_STUDENTS = {
  azul: 'joao.azul@demo.pgt',
  // Maria teaches No-Gi Noite: she sees Perfil → Meu repasse.
  roxa: 'maria.roxa@demo.pgt',
  brancaOverdue: 'pedro.branca.overdue@demo.pgt',
  brancaPending: 'lucas.branca.pending@demo.pgt',
  marrom: 'ana.costa@demo.pgt',
  azul2: 'beatriz.lopes@demo.pgt',
  branca: 'tiago.martins@demo.pgt',
} as const;

// Family account (ADR 0004): a Responsible who doesn't train, acting for two kids.
export const DEMO_RESPONSIBLE_EMAIL = 'paula.lima@demo.pgt';

type Db = typeof defaultDb;

interface SeedGuideOptions {
  db?: Db;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ym = (d: Date) => ymd(d).slice(0, 7);

/**
 * Seeds the canonical "Academia Demo PGT" fixtures used by the documentation
 * screenshot capture script. Idempotent: on second run it clears all child rows
 * belonging to the demo academy (keeping the academy row itself so its UUID stays
 * stable) and reseeds everything fresh.
 *
 * Times are the process's local time: run it with TZ=Europe/Lisbon (the npm script does)
 * so classes and check-ins line up with the academy's clock.
 */
export async function seedGuide(options: SeedGuideOptions = {}): Promise<void> {
  const db = (options.db ?? defaultDb) as Db;

  // 1. Upsert academy — preserves the UUID across runs so the idempotency assertion holds.
  const [acad] = await db
    .insert(schema.academy)
    .values({ name: DEMO_ACADEMY_NAME, slug: DEMO_ACADEMY_SLUG, joinCode: DEMO_JOIN_CODE, city: DEMO_ACADEMY_CITY })
    .onConflictDoUpdate({
      target: schema.academy.slug,
      set: { name: DEMO_ACADEMY_NAME, joinCode: DEMO_JOIN_CODE, city: DEMO_ACADEMY_CITY },
    })
    .returning();
  const demoId = acad.id;

  // 2. Idempotency: wipe all child rows belonging to this academy (FK order) without changing its UUID.
  const demoUsers = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.academyId, demoId));
  const userIds = demoUsers.map((u) => u.id);
  await db.delete(schema.payment).where(eq(schema.payment.academyId, demoId));
  await db.delete(schema.familyPayment).where(eq(schema.familyPayment.academyId, demoId));
  await db.delete(schema.waivedMonth).where(eq(schema.waivedMonth.academyId, demoId));
  await db.delete(schema.familySuggestionDismissal).where(eq(schema.familySuggestionDismissal.academyId, demoId));
  if (userIds.length > 0) {
    await db.delete(schema.studentMembership).where(inArray(schema.studentMembership.studentId, userIds));
    await db.delete(schema.studentModality).where(inArray(schema.studentModality.studentId, userIds));
    await db.delete(schema.xpEntry).where(inArray(schema.xpEntry.studentId, userIds));
    await db.delete(schema.studentBadge).where(inArray(schema.studentBadge.studentId, userIds));
    await db.delete(schema.streak).where(inArray(schema.streak.studentId, userIds));
  }
  await db.delete(schema.badgeDefinition).where(eq(schema.badgeDefinition.academyId, demoId));
  const demoSeasons = await db.select({ id: schema.season.id }).from(schema.season).where(eq(schema.season.academyId, demoId));
  if (demoSeasons.length > 0) {
    await db.delete(schema.competitionResult).where(
      inArray(
        schema.competitionResult.seasonId,
        demoSeasons.map((s) => s.id),
      ),
    );
  }
  await db.delete(schema.season).where(eq(schema.season.academyId, demoId));
  await db.update(schema.user).set({ familyId: null }).where(eq(schema.user.academyId, demoId));
  await db.delete(schema.expense).where(eq(schema.expense.academyId, demoId));
  await db.delete(schema.payoutSheet).where(eq(schema.payoutSheet.academyId, demoId));
  await db.delete(schema.family).where(eq(schema.family.academyId, demoId));
  await db.delete(schema.modality).where(eq(schema.modality.academyId, demoId));
  const demoProducts = await db.select({ id: schema.product.id }).from(schema.product).where(eq(schema.product.academyId, demoId));
  if (demoProducts.length > 0) {
    await db.delete(schema.order).where(
      inArray(
        schema.order.productId,
        demoProducts.map((p) => p.id),
      ),
    );
  }
  await db.delete(schema.product).where(eq(schema.product.academyId, demoId));
  const demoTournaments = await db
    .select({ id: schema.tournament.id })
    .from(schema.tournament)
    .where(eq(schema.tournament.academyId, demoId));
  if (demoTournaments.length > 0) {
    await db.delete(schema.tournamentSignup).where(
      inArray(
        schema.tournamentSignup.tournamentId,
        demoTournaments.map((t) => t.id),
      ),
    );
  }
  await db.delete(schema.tournament).where(eq(schema.tournament.academyId, demoId));

  // Classes are referenced by checkin and checkin_token — delete those first.
  const demoClasses = await db.select({ id: schema.bjjClass.id }).from(schema.bjjClass).where(eq(schema.bjjClass.academyId, demoId));
  const classIds = demoClasses.map((c) => c.id);
  if (classIds.length > 0) {
    await db.delete(schema.checkinToken).where(inArray(schema.checkinToken.classId, classIds));
    await db.delete(schema.checkin).where(inArray(schema.checkin.classId, classIds));
    await db.delete(schema.seminarParticipant).where(inArray(schema.seminarParticipant.classId, classIds));
  }
  await db.delete(schema.bjjClass).where(eq(schema.bjjClass.academyId, demoId));

  // 3. Owner — upsert by email so the UUID stays stable. Role 'owner' + academy.ownerId (requireOwner checks both).
  const [instructor] = await db
    .insert(schema.user)
    .values({
      academyId: demoId,
      email: DEMO_INSTRUCTOR_EMAIL,
      name: 'Professora Demo PGT',
      role: 'owner',
      belt: 'black',
      dateOfBirth: '1985-03-15',
      status: 'active',
      emailVerified: false,
    })
    .onConflictDoUpdate({
      target: schema.user.email,
      set: { academyId: demoId, name: 'Professora Demo PGT', role: 'owner', belt: 'black', status: 'active' },
    })
    .returning();
  await db.update(schema.academy).set({ ownerId: instructor.id }).where(eq(schema.academy.id, demoId));

  // 4. Students — upsert by email for stable UUIDs. Beatriz and Tiago share a phone: a "Possível família".
  const students = [
    { email: DEMO_STUDENTS.azul, name: 'João Silva', belt: 'blue', dateOfBirth: '1995-06-20', phone: '912 111 222', status: 'active' },
    { email: DEMO_STUDENTS.roxa, name: 'Maria Oliveira', belt: 'purple', dateOfBirth: '1992-11-10', phone: '913 444 555', status: 'active' },
    { email: DEMO_STUDENTS.brancaOverdue, name: 'Pedro Souza', belt: 'white', dateOfBirth: '1998-04-22', phone: '914 555 666', status: 'active' },
    { email: DEMO_STUDENTS.brancaPending, name: 'Lucas Pereira', belt: 'white', dateOfBirth: '2000-01-15', phone: '915 777 888', status: 'pending' },
    { email: DEMO_STUDENTS.marrom, name: 'Ana Costa', belt: 'brown', dateOfBirth: '1990-08-02', phone: '916 123 456', status: 'active' },
    { email: DEMO_STUDENTS.azul2, name: 'Beatriz Lopes', belt: 'blue', dateOfBirth: '1997-02-14', phone: '917 222 333', status: 'active' },
    { email: DEMO_STUDENTS.branca, name: 'Tiago Martins', belt: 'white', dateOfBirth: '2001-12-01', phone: '917 222 333', status: 'active' },
  ] as const;
  const [azul, roxa, pedro, , ana, beatriz, tiago] = await db
    .insert(schema.user)
    .values(students.map((s) => ({ ...s, academyId: demoId, role: 'student' as const, emailVerified: false })))
    .onConflictDoUpdate({
      target: schema.user.email,
      set: {
        academyId: demoId,
        name: sql`excluded.name`,
        belt: sql`excluded.belt`,
        phone: sql`excluded.phone`,
        status: sql`excluded.status`,
      },
    })
    .returning();

  // 4b. Família Lima — Paula (login only, doesn't train) acts for Alice and Afonso.
  //     Dependents have no login and an internal email that is never shown.
  const familyValues = [
    { email: DEMO_RESPONSIBLE_EMAIL, name: 'Paula Lima', role: 'responsible' as const, belt: 'white' as const, dateOfBirth: '1984-02-10', phone: '918 765 432' },
    { email: 'alice.lima@dependente.pgt.invalid', name: 'Alice Lima', role: 'student' as const, belt: 'grey' as const, dateOfBirth: '2016-05-03', phone: null },
    { email: 'afonso.lima@dependente.pgt.invalid', name: 'Afonso Lima', role: 'student' as const, belt: 'yellow' as const, dateOfBirth: '2014-09-12', phone: null },
  ].map((v) => ({ ...v, academyId: demoId, status: 'active' as const, emailVerified: false }));
  const [responsible, ...dependents] = await db
    .insert(schema.user)
    .values(familyValues)
    .onConflictDoUpdate({
      target: schema.user.email,
      set: { academyId: demoId, status: schema.user.status },
    })
    .returning();
  const [alice, afonso] = dependents;
  const [lima] = await db
    .insert(schema.family)
    .values({ academyId: demoId, name: 'Família Lima', responsibleUserId: responsible.id })
    .returning();
  await db
    .update(schema.user)
    .set({ familyId: lima.id })
    .where(
      inArray(
        schema.user.id,
        dependents.map((d) => d.id),
      ),
    );

  // 5. Modalities — the academy defaults.
  const modalities = await db
    .insert(schema.modality)
    .values(schema.DEFAULT_MODALITIES.map((name) => ({ academyId: demoId, name })))
    .returning();
  const mod = (name: string) => modalities.find((m) => m.name === name)!.id;
  await db.insert(schema.studentModality).values([
    { studentId: azul.id, modalityId: mod('Jiu-Jitsu') },
    { studentId: roxa.id, modalityId: mod('Jiu-Jitsu') },
    { studentId: roxa.id, modalityId: mod('MMA') },
    { studentId: pedro.id, modalityId: mod('Jiu-Jitsu') },
    { studentId: ana.id, modalityId: mod('Jiu-Jitsu') },
    { studentId: beatriz.id, modalityId: mod('Jiu-Jitsu') },
    { studentId: beatriz.id, modalityId: mod('Feminino') },
    { studentId: tiago.id, modalityId: mod('MMA') },
    { studentId: alice.id, modalityId: mod('Kids') },
    { studentId: afonso.id, modalityId: mod('Kids') },
  ]);

  // 6. Monthly Fees — the pending student has none. dueDay is 5 days before today so unpaid months are overdue.
  const now = new Date();
  const todayDate = ymd(now);
  const year = now.getFullYear();
  const dueDay = Math.max(1, Math.min(28, now.getDate() - 5));
  const monthsAgo = (n: number) => new Date(year, now.getMonth() - n, 1);
  const membership = (studentId: string, monthlyFee: string, startedMonthsAgo: number) => ({
    studentId,
    monthlyFee,
    startDate: ymd(monthsAgo(startedMonthsAgo)),
    dueDay,
  });
  await db.insert(schema.studentMembership).values([
    membership(azul.id, '45.00', 2),
    membership(roxa.id, '65.00', 0),
    membership(pedro.id, '45.00', 3),
    membership(ana.id, '60.00', 2),
    membership(beatriz.id, '45.00', 2),
    membership(tiago.id, '45.00', 2),
    membership(alice.id, '35.00', 1),
    membership(afonso.id, '35.00', 1),
  ]);

  // 7. Payments. João, Maria, Ana and Beatriz are up to date; Tiago owes this month (a yellow card);
  //    Pedro last paid 3 months ago; the Família Lima owes last month and this one (a family card).
  const paymentRows: (typeof schema.payment.$inferInsert)[] = [];
  const pay = (studentId: string, amount: string, n: number) => {
    const d = new Date(year, now.getMonth() - n, Math.min(dueDay, 28));
    paymentRows.push({ studentId, academyId: demoId, amount, paymentDate: ymd(d), referenceMonth: ym(d), recordedBy: instructor.id });
  };
  for (const n of [0, 1, 2]) {
    pay(azul.id, '45.00', n);
    pay(ana.id, '60.00', n);
    pay(beatriz.id, '45.00', n);
  }
  pay(roxa.id, '65.00', 0);
  pay(tiago.id, '45.00', 1);
  pay(tiago.id, '45.00', 2);
  pay(pedro.id, '45.00', 3);
  await db.insert(schema.payment).values(paymentRows);

  // 8. Classes (academy time). Classes sharing a name share a Payout Sheet: No-Gi Noite (Maria) and
  //    Kids (Ana) have a teacher who isn't the owner. "Fundamentos (Demo)" runs right now so the totem
  //    always has a QR code; "Open Mat" later today is the totem's next class when nothing is open.
  const nowHour = now.getHours();
  const nowDay = now.getDay();
  const weekly = (name: string, type: 'gi' | 'no-gi' | 'open-mat' | 'kids', dayOfWeek: number, start: string, end: string, teacherId: string) => ({
    academyId: demoId,
    instructorId: instructor.id,
    teacherId,
    name,
    type,
    recurrence: 'weekly' as const,
    dayOfWeek,
    startTime: start,
    endTime: end,
  });
  const classes = await db
    .insert(schema.bjjClass)
    .values([
      weekly('Gi Manhã', 'gi', 1, '07:00', '08:30', instructor.id),
      weekly('Gi Manhã', 'gi', 5, '07:00', '08:30', instructor.id),
      weekly('No-Gi Noite', 'no-gi', 2, '19:00', '20:30', roxa.id),
      weekly('No-Gi Noite', 'no-gi', 4, '19:00', '20:30', roxa.id),
      weekly('Kids', 'kids', 3, '18:00', '19:00', ana.id),
      weekly('Fundamentos (Demo)', 'gi', nowDay, `${pad(Math.max(0, nowHour - 1))}:00`, `${pad(Math.min(23, nowHour + 1))}:30`, instructor.id),
      ...(nowHour + 3 <= 22 ? [weekly('Open Mat', 'open-mat', nowDay, `${pad(nowHour + 3)}:00`, `${pad(nowHour + 4)}:00`, instructor.id)] : []),
    ])
    .returning();

  // 8a. Check-ins over the last 9 weeks. Each adult skips some classes and Tiago never trains No-Gi; Pedro stopped 15 days ago
  //     (Afastando), Tiago 9 days ago (Desacelerando). João hasn't checked in today (the guide shows his
  //     Check-in button).
  const adults = [azul, roxa, pedro, ana, beatriz, tiago];
  const lastDay: Record<string, number> = { [pedro.id]: 15, [tiago.id]: 9 };
  const checkinRows: (typeof schema.checkin.$inferInsert)[] = [];
  for (let daysAgo = 63; daysAgo >= 0; daysAgo--) {
    const day = new Date(year, now.getMonth(), now.getDate() - daysAgo);
    for (const c of classes) {
      if (c.dayOfWeek !== day.getDay()) {
        continue;
      }
      const [h, m] = c.startTime.split(':').map(Number);
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m + 5);
      if (at > now) {
        continue;
      }
      const attendees = c.type === 'kids' ? [alice, afonso] : adults.filter((s) => s.id !== c.teacherId && !(c.type === 'no-gi' && s.id === tiago.id));
      attendees.forEach((s, i) => {
        const skips = (daysAgo + i * 2) % 5 === 0;
        const stopped = lastDay[s.id] !== undefined && daysAgo < lastDay[s.id];
        if (skips || stopped || (daysAgo === 0 && s.id === azul.id)) {
          return;
        }
        checkinRows.push({ classId: c.id, studentId: s.id, source: i % 2 ? 'qr' : 'button', checkedInAt: at });
      });
    }
  }
  await db.insert(schema.checkin).values(checkinRows);
  await db.insert(schema.streak).values([
    { studentId: azul.id, currentStreak: 9, longestStreak: 12, lastCheckinWeek: null },
    { studentId: roxa.id, currentStreak: 9, longestStreak: 9, lastCheckinWeek: null },
    { studentId: ana.id, currentStreak: 9, longestStreak: 15, lastCheckinWeek: null },
    { studentId: beatriz.id, currentStreak: 9, longestStreak: 9, lastCheckinWeek: null },
    { studentId: tiago.id, currentStreak: 0, longestStreak: 7, lastCheckinWeek: null },
    { studentId: pedro.id, currentStreak: 0, longestStreak: 5, lastCheckinWeek: null },
  ]);

  // 8b. A Seminar three days from now with a Guest Teacher: one Student pending, one paid, one outsider paid.
  const seminarDay = new Date(year, now.getMonth(), now.getDate() + 3);
  const [seminar] = await db
    .insert(schema.bjjClass)
    .values({
      academyId: demoId,
      instructorId: instructor.id,
      guestTeacherName: 'Ricardo Almeida',
      name: 'Passagem de guarda',
      type: 'gi' as const,
      recurrence: 'once' as const,
      dayOfWeek: seminarDay.getDay(),
      date: ymd(seminarDay),
      startTime: '10:00',
      endTime: '13:00',
      isSeminar: true,
      studentPrice: '40.00',
      outsiderPrice: '50.00',
    })
    .returning();
  await db.insert(schema.seminarParticipant).values([
    { classId: seminar.id, studentId: azul.id, amount: '40.00' },
    { classId: seminar.id, studentId: roxa.id, amount: '40.00', paidAt: todayDate },
    { classId: seminar.id, name: 'Marta Sousa', phone: '912 345 678', amount: '50.00', paidAt: todayDate },
  ]);

  // 8c. A later Seminar, ~25 days out with no sign-ups yet: shows past the day strip, in the Seminários tab.
  const laterDay = new Date(year, now.getMonth(), now.getDate() + 25);
  await db.insert(schema.bjjClass).values({
    academyId: demoId,
    instructorId: instructor.id,
    teacherId: instructor.id,
    name: 'Leg locks',
    type: 'no-gi' as const,
    recurrence: 'once' as const,
    dayOfWeek: laterDay.getDay(),
    date: ymd(laterDay),
    startTime: '10:00',
    endTime: '12:00',
    isSeminar: true,
    studentPrice: '40.00',
    outsiderPrice: '50.00',
  });

  // 8d. Financeiro — Payout Sheets: No-Gi Noite confirmed for the last two months and a draft this month
  //     (Tiago added by hand, no No-Gi check-ins); Kids confirmed last month, not started this month.
  //     Recurring expenses for last month and this one.
  const sheet = async (className: string, n: number, confirmed: boolean, lines: [string, string | null, boolean?][]) => {
    const [s] = await db
      .insert(schema.payoutSheet)
      .values({ academyId: demoId, className, month: ym(monthsAgo(n)), confirmedAt: confirmed ? monthsAgo(n - 1) : null })
      .returning();
    await db.insert(schema.payoutLine).values(lines.map(([studentId, amount, addedByHand]) => ({ sheetId: s.id, studentId, amount, addedByHand: !!addedByHand })));
  };
  await sheet('No-Gi Noite', 2, true, [
    [azul.id, '15.00'],
    [ana.id, '20.00'],
    [beatriz.id, '15.00'],
  ]);
  await sheet('No-Gi Noite', 1, true, [
    [azul.id, '15.00'],
    [pedro.id, null],
    [ana.id, '20.00'],
    [beatriz.id, '15.00'],
    [tiago.id, '15.00', true],
  ]);
  await sheet('No-Gi Noite', 0, false, [
    [azul.id, '15.00'],
    [ana.id, '20.00'],
    [tiago.id, '10.00', true],
  ]);
  await sheet('Kids', 1, true, [
    [alice.id, '12.00'],
    [afonso.id, '12.00'],
  ]);
  await db.insert(schema.expense).values(
    [ym(monthsAgo(1)), ym(now)].flatMap((month) =>
      [
        ['Renda', '120.00'],
        ['Luz', '27.40'],
        ['Água', '12.15'],
        ['Internet', '25.00'],
      ].map(([description, amount]) => ({ academyId: demoId, month, description, amount })),
    ),
  );

  // 9. Ranking — this year's season (as a new academy gets) and last year's. Approved results, pending
  //    ones to review, a rejected one, and the carried-over points every student was imported with.
  const [current] = await db
    .insert(schema.season)
    .values([
      { academyId: demoId, name: `Ranking ${year}`, startDate: `${year}-01-01`, endDate: `${year}-12-31`, pointsConfig: { 1: 10, 2: 7, 3: 5 }, prizeDescription: 'Kimono da academia para o 1º lugar' },
      { academyId: demoId, name: `Ranking ${year - 1}`, startDate: `${year - 1}-01-01`, endDate: `${year - 1}-12-31`, pointsConfig: { 1: 10, 2: 7, 3: 5 } },
    ])
    .returning();
  const recent = ymd(new Date(Math.max(new Date(year, 0, 2).getTime(), now.getTime() - 10 * 86_400_000)));
  const carried = 'Pontos acumulados até a Mafra Cup';
  const results = [
    [azul, carried, `${year}-03-14`, null, 24, 'approved'],
    [azul, 'Mafra Cup', `${year}-03-14`, 1, 10, 'approved'],
    [roxa, carried, `${year}-03-14`, null, 31, 'approved'],
    [roxa, 'Mafra Cup', `${year}-03-14`, 2, 7, 'approved'],
    [ana, carried, `${year}-03-14`, null, 12, 'approved'],
    [ana, 'Open de Lisboa', `${year}-06-07`, 3, 5, 'approved'],
    [beatriz, 'Mafra Cup', `${year}-03-14`, 1, 10, 'approved'],
    [afonso, 'Copa Kids Sintra', `${year}-05-10`, 1, 10, 'approved'],
    [alice, 'Copa Kids Sintra', `${year}-05-10`, 2, 7, 'approved'],
    [pedro, 'Torneio Interno', `${year}-04-20`, 3, 0, 'rejected'],
    [pedro, 'Copa Pontinha', recent, 1, 0, 'pending'],
    [tiago, 'Copa Pontinha', recent, 2, 0, 'pending'],
  ] as const;
  const resultRows = await db
    .insert(schema.competitionResult)
    .values(
      results.map(([s, competitionName, competitionDate, position, pointsAwarded, status]) => ({
        seasonId: current.id,
        studentId: s.id,
        competitionName,
        competitionDate,
        position,
        pointsAwarded,
        status,
        submittedBy: position === null ? instructor.id : s.id,
        reviewedBy: status === 'pending' ? null : instructor.id,
      })),
    )
    .returning();
  await db.insert(schema.xpEntry).values(
    resultRows
      .filter((r) => r.status === 'approved')
      .map((r) => ({ studentId: r.studentId, xpAmount: r.pointsAwarded * 10, sourceType: 'competition' as const, sourceId: r.id })),
  );
  const badges = await db
    .insert(schema.badgeDefinition)
    .values([
      { academyId: demoId, name: '100 Aulas', description: 'Completou 100 aulas', icon: '💯', criteriaType: 'classes_count', criteriaValue: 100 },
      { academyId: demoId, name: 'Primeira Competição', description: 'Competiu pela primeira vez', icon: '🥋', criteriaType: 'first_competition', criteriaValue: 1 },
      { academyId: demoId, name: 'Mês Perfeito', description: 'Treinou todas as semanas do mês', icon: '🔥', criteriaType: 'perfect_month', criteriaValue: 4 },
    ])
    .returning();
  await db.insert(schema.studentBadge).values([
    { studentId: azul.id, badgeDefinitionId: badges[1].id },
    { studentId: azul.id, badgeDefinitionId: badges[2].id },
  ]);

  // 10. Tournament with two sign-ups.
  const inTwoMonths = new Date(year, now.getMonth() + 2, 15);
  const [openLisboa] = await db
    .insert(schema.tournament)
    .values({ academyId: demoId, name: `Open Lisboa ${inTwoMonths.getFullYear()}`, date: ymd(inTwoMonths), location: 'Lisboa, Portugal', federation: 'IBJJF' })
    .returning();
  await db.insert(schema.tournamentSignup).values([
    { tournamentId: openLisboa.id, studentId: roxa.id, weightClass: 'Pena (-64 kg)' },
    { tournamentId: openLisboa.id, studentId: ana.id, weightClass: 'Leve (-70 kg)' },
  ]);

  // 11. Shop — three products and orders in every status.
  const [kimono, rash, faixa] = await db
    .insert(schema.product)
    .values([
      { academyId: demoId, name: 'Kimono Academia Demo', description: 'Kimono oficial da Academia Demo PGT', price: '89.90', stock: 10 },
      { academyId: demoId, name: 'Rash guard', description: 'Manga comprida, com o logo da academia', price: '34.90', stock: 15 },
      { academyId: demoId, name: 'Faixa', description: 'Faixa de algodão, todas as cores', price: '15.00', stock: 20 },
    ])
    .returning();
  await db.insert(schema.order).values([
    { productId: rash.id, studentId: beatriz.id, status: 'requested' as const, createdAt: new Date(now.getTime() - 86_400_000) },
    { productId: kimono.id, studentId: roxa.id, status: 'confirmed' as const, createdAt: new Date(now.getTime() - 4 * 86_400_000) },
    { productId: faixa.id, studentId: ana.id, status: 'delivered' as const, createdAt: new Date(now.getTime() - 12 * 86_400_000) },
    { productId: rash.id, studentId: tiago.id, status: 'cancelled' as const, createdAt: new Date(now.getTime() - 20 * 86_400_000) },
  ]);
}

// CLI entry point — allows `npx tsx src/db/seed-guide.ts` from apps/api.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedGuide()
    .then(() => {
      console.log('seed-guide complete');
      process.exit(0);
    })
    .catch((e) => {
      console.error('seed-guide failed:', e);
      process.exit(1);
    });
}
