import { eq, inArray } from 'drizzle-orm';
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
  roxa: 'maria.roxa@demo.pgt',
  brancaOverdue: 'pedro.branca.overdue@demo.pgt',
  brancaPending: 'lucas.branca.pending@demo.pgt',
} as const;

// Family account (ADR 0004): a Responsible who doesn't train, acting for two kids.
export const DEMO_RESPONSIBLE_EMAIL = 'paula.lima@demo.pgt';

type Db = typeof defaultDb;

interface SeedGuideOptions {
  db?: Db;
}

/**
 * Seeds the canonical "Academia Demo PGT" fixtures used by the documentation
 * screenshot capture script. Idempotent: on second run it clears all child rows
 * belonging to the demo academy (keeping the academy row itself so its UUID stays
 * stable) and reseeds everything fresh.
 */
export async function seedGuide(
  options: SeedGuideOptions = {},
): Promise<void> {
  const db = (options.db ?? defaultDb) as Db;

  // 1. Upsert academy — preserves the UUID across runs so the idempotency assertion holds.
  const [acad] = await db
    .insert(schema.academy)
    .values({
      name: DEMO_ACADEMY_NAME,
      slug: DEMO_ACADEMY_SLUG,
      joinCode: DEMO_JOIN_CODE,
      city: DEMO_ACADEMY_CITY,
    })
    .onConflictDoUpdate({
      target: schema.academy.slug,
      set: {
        name: DEMO_ACADEMY_NAME,
        joinCode: DEMO_JOIN_CODE,
        city: DEMO_ACADEMY_CITY,
      },
    })
    .returning();

  const demoId = acad.id;

  // 2. Idempotency: wipe all child rows belonging to this academy so subsequent
  //    runs start clean without changing the academy UUID.
  await db
    .delete(schema.payment)
    .where(eq(schema.payment.academyId, demoId));

  const demoUsers = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.academyId, demoId));
  for (const u of demoUsers) {
    await db
      .delete(schema.studentMembership)
      .where(eq(schema.studentMembership.studentId, u.id));
    await db
      .delete(schema.studentModality)
      .where(eq(schema.studentModality.studentId, u.id));
  }

  await db
    .update(schema.user)
    .set({ familyId: null, addOnTeacherId: null, recruitedById: null })
    .where(eq(schema.user.academyId, demoId));
  await db
    .delete(schema.expense)
    .where(eq(schema.expense.academyId, demoId));
  await db
    .delete(schema.teacherPayout)
    .where(eq(schema.teacherPayout.academyId, demoId));
  await db
    .delete(schema.family)
    .where(eq(schema.family.academyId, demoId));
  await db
    .delete(schema.modality)
    .where(eq(schema.modality.academyId, demoId));
  await db
    .delete(schema.product)
    .where(eq(schema.product.academyId, demoId));
  await db
    .delete(schema.tournament)
    .where(eq(schema.tournament.academyId, demoId));

  // Classes are referenced by checkin and checkin_token — delete those first
  // or the FK constraint blocks the class delete on re-runs.
  const demoClasses = await db
    .select({ id: schema.bjjClass.id })
    .from(schema.bjjClass)
    .where(eq(schema.bjjClass.academyId, demoId));
  const classIds = demoClasses.map((c) => c.id);
  if (classIds.length > 0) {
    await db
      .delete(schema.checkinToken)
      .where(inArray(schema.checkinToken.classId, classIds));
    await db
      .delete(schema.checkin)
      .where(inArray(schema.checkin.classId, classIds));
    await db
      .delete(schema.seminarParticipant)
      .where(inArray(schema.seminarParticipant.classId, classIds));
  }
  await db
    .delete(schema.bjjClass)
    .where(eq(schema.bjjClass.academyId, demoId));

  // 3. Instructor (also academy owner) — upsert by email so UUID stays stable
  // across runs. Role is 'owner' because this user is set as `academy.ownerId`
  // below, and the owner dashboard gate (`requireOwner`) checks both the FK
  // and the role enum value.
  const instructorValues = {
    academyId: acad.id,
    email: DEMO_INSTRUCTOR_EMAIL,
    name: 'Professora Demo PGT',
    role: 'owner' as const,
    belt: 'black' as const,
    dateOfBirth: '1985-03-15',
    status: 'active' as const,
    emailVerified: false,
  };
  const [instructor] = await db
    .insert(schema.user)
    .values(instructorValues)
    .onConflictDoUpdate({
      target: schema.user.email,
      set: {
        academyId: acad.id,
        name: instructorValues.name,
        role: instructorValues.role,
        belt: instructorValues.belt,
        status: instructorValues.status,
      },
    })
    .returning();

  await db
    .update(schema.academy)
    .set({ ownerId: instructor.id })
    .where(eq(schema.academy.id, acad.id));

  // 4. Students — 4 varied states; upsert by email for stable UUIDs.
  const studentValues = [
    {
      academyId: acad.id,
      email: DEMO_STUDENTS.azul,
      name: 'João Silva',
      role: 'student' as const,
      belt: 'blue' as const,
      dateOfBirth: '1995-06-20',
      status: 'active' as const,
      emailVerified: false,
    },
    {
      academyId: acad.id,
      email: DEMO_STUDENTS.roxa,
      name: 'Maria Oliveira',
      role: 'student' as const,
      belt: 'purple' as const,
      dateOfBirth: '1992-11-10',
      status: 'active' as const,
      emailVerified: false,
    },
    {
      academyId: acad.id,
      email: DEMO_STUDENTS.brancaOverdue,
      name: 'Pedro Souza',
      role: 'student' as const,
      belt: 'white' as const,
      dateOfBirth: '1998-04-22',
      status: 'active' as const,
      emailVerified: false,
    },
    {
      academyId: acad.id,
      email: DEMO_STUDENTS.brancaPending,
      name: 'Lucas Pereira',
      role: 'student' as const,
      belt: 'white' as const,
      dateOfBirth: '2000-01-15',
      status: 'pending' as const,
      emailVerified: false,
    },
  ];
  const [azul, roxa, brancaOverdue] = await db
    .insert(schema.user)
    .values(studentValues)
    .onConflictDoUpdate({
      target: schema.user.email,
      set: {
        academyId: acad.id,
        belt: schema.user.belt,
        status: schema.user.status,
      },
    })
    .returning();

  // 4b. Família Lima — Paula (login only, doesn't train) acts for Alice and Afonso.
  //     Dependents have no login and an internal email that is never shown.
  const familyValues = [
    { email: DEMO_RESPONSIBLE_EMAIL, name: 'Paula Lima', role: 'responsible' as const, belt: 'white' as const, dateOfBirth: '1984-02-10' },
    { email: 'alice.lima@dependente.pgt.invalid', name: 'Alice Lima', role: 'student' as const, belt: 'grey' as const, dateOfBirth: '2016-05-03' },
    { email: 'afonso.lima@dependente.pgt.invalid', name: 'Afonso Lima', role: 'student' as const, belt: 'yellow' as const, dateOfBirth: '2014-09-12' },
  ].map((v) => ({ ...v, academyId: acad.id, status: 'active' as const, emailVerified: false }));
  const [responsible, ...dependents] = await db
    .insert(schema.user)
    .values(familyValues)
    .onConflictDoUpdate({
      target: schema.user.email,
      set: { academyId: acad.id, status: schema.user.status },
    })
    .returning();
  const [lima] = await db
    .insert(schema.family)
    .values({ academyId: acad.id, name: 'Família Lima', responsibleUserId: responsible.id })
    .returning();
  await db
    .update(schema.user)
    .set({ familyId: lima.id })
    .where(inArray(schema.user.id, dependents.map((d) => d.id)));

  // 5. Modalities — João trains Jiu-Jitsu, Maria Jiu-Jitsu and MMA.
  const [jiuJitsu, mma] = await db
    .insert(schema.modality)
    .values([
      { academyId: acad.id, name: 'Jiu-Jitsu' },
      { academyId: acad.id, name: 'MMA' },
    ])
    .returning();
  await db.insert(schema.studentModality).values([
    { studentId: azul.id, modalityId: jiuJitsu.id },
    { studentId: roxa.id, modalityId: jiuJitsu.id },
    { studentId: roxa.id, modalityId: mma.id },
  ]);

  // 6. Memberships — active students only; pending student has none yet.
  //    dueDay is set 5 days before today so Pedro's payments appear overdue.
  const now = new Date();
  const dueDay = Math.max(1, Math.min(28, now.getDate() - 5));
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  // Start azul and brancaOverdue 3 months ago to enable multi-month history.
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const threeMonthsAgoStr = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;

  await db.insert(schema.studentMembership).values([
    {
      studentId: azul.id,
      monthlyFee: '180.00',
      startDate: threeMonthsAgoStr,
      dueDay,
    },
    {
      studentId: roxa.id,
      monthlyFee: '180.00',
      startDate: monthStart,
      dueDay,
    },
    {
      studentId: brancaOverdue.id,
      monthlyFee: '180.00',
      startDate: threeMonthsAgoStr,
      dueDay,
    },
  ]);

  // 7. Payments
  //    João (azul): 3 months paid, up to date.
  const paymentRows: (typeof schema.payment.$inferInsert)[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, dueDay);
    const refMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const paymentDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(Math.min(dueDay, 28)).padStart(2, '0')}`;
    paymentRows.push({
      studentId: azul.id,
      academyId: acad.id,
      amount: '180.00',
      paymentDate,
      referenceMonth: refMonth,
      recordedBy: instructor.id,
    });
  }
  //    Pedro (brancaOverdue): last paid 3 months ago — leaves 2 months + current overdue.
  {
    const d = new Date(now.getFullYear(), now.getMonth() - 3, dueDay);
    const refMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const paymentDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(Math.min(dueDay, 28)).padStart(2, '0')}`;
    paymentRows.push({
      studentId: brancaOverdue.id,
      academyId: acad.id,
      amount: '180.00',
      paymentDate,
      referenceMonth: refMonth,
      recordedBy: instructor.id,
    });
  }
  //    Maria (roxa): current month NOT yet paid — eligible for quick-pay.
  await db.insert(schema.payment).values(paymentRows);

  // 8. Classes — 2 weekly recurring + one "currently running" so the totem
  //    page always has a class to show regardless of when the screenshot
  //    capture script runs.
  const nowHour = now.getHours();
  const nowDay = now.getDay(); // 0-6
  const startHour = Math.max(0, nowHour - 1);
  const endHour = Math.min(23, nowHour + 2);
  const pad = (n: number) => String(n).padStart(2, '0');
  await db.insert(schema.bjjClass).values([
    {
      academyId: acad.id,
      instructorId: instructor.id,
      teacherId: instructor.id,
      name: 'Gi Manhã',
      type: 'gi' as const,
      recurrence: 'weekly' as const,
      dayOfWeek: 1,
      startTime: '07:00',
      endTime: '08:30',
    },
    {
      academyId: acad.id,
      instructorId: instructor.id,
      teacherId: roxa.id,
      name: 'No-Gi Noite',
      type: 'no-gi' as const,
      recurrence: 'weekly' as const,
      dayOfWeek: 3,
      startTime: '19:00',
      endTime: '20:30',
    },
    {
      academyId: acad.id,
      instructorId: instructor.id,
      teacherId: instructor.id,
      name: 'Fundamentos (Demo)',
      type: 'gi' as const,
      recurrence: 'weekly' as const,
      dayOfWeek: nowDay,
      startTime: `${pad(startHour)}:00`,
      endTime: `${pad(endHour)}:00`,
    },
  ]);

  // 8b. A Seminar three days from now with a Guest Teacher: one Student pending, one paid, one outsider paid.
  const seminarDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3);
  const seminarDate = `${seminarDay.getFullYear()}-${pad(seminarDay.getMonth() + 1)}-${pad(seminarDay.getDate())}`;
  const todayDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const [seminar] = await db
    .insert(schema.bjjClass)
    .values({
      academyId: acad.id,
      instructorId: instructor.id,
      guestTeacherName: 'Ricardo Almeida',
      name: 'Passagem de guarda',
      type: 'gi' as const,
      recurrence: 'once' as const,
      dayOfWeek: seminarDay.getDay(),
      date: seminarDate,
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
  const laterDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 25);
  await db.insert(schema.bjjClass).values({
    academyId: acad.id,
    instructorId: instructor.id,
    teacherId: instructor.id,
    name: 'Leg locks',
    type: 'no-gi' as const,
    recurrence: 'once' as const,
    dayOfWeek: laterDay.getDay(),
    date: `${laterDay.getFullYear()}-${pad(laterDay.getMonth() + 1)}-${pad(laterDay.getDate())}`,
    startTime: '10:00',
    endTime: '12:00',
    isSeminar: true,
    studentPrice: '40.00',
    outsiderPrice: '50.00',
  });

  // 8d. Financeiro — Maria teaches No-Gi Noite and is the Payout Teacher: João pays the
  //     Class Add-on with her, Pedro is her Recruited Student. Recurring expenses for
  //     last month and this one.
  await db
    .update(schema.user)
    .set({ addOnTeacherId: roxa.id })
    .where(eq(schema.user.id, azul.id));
  await db
    .update(schema.user)
    .set({ recruitedById: roxa.id })
    .where(eq(schema.user.id, brancaOverdue.id));
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const expenseMonths = [
    `${lastMonth.getFullYear()}-${pad(lastMonth.getMonth() + 1)}`,
    monthStart.slice(0, 7),
  ];
  await db.insert(schema.expense).values(
    expenseMonths.flatMap((month) =>
      [
        ['Renda', '1200.00'],
        ['Luz', '87.40'],
        ['Água', '32.15'],
        ['Internet', '35.00'],
      ].map(([description, amount]) => ({ academyId: acad.id, month, description, amount })),
    ),
  );

  // 9. Tournament — no createdBy column in the schema; only academyId, name, date, location, federation.
  const inTwoMonths = new Date(now.getFullYear(), now.getMonth() + 2, 15);
  await db.insert(schema.tournament).values({
    academyId: acad.id,
    name: 'Open Lisboa 2026',
    date: `${inTwoMonths.getFullYear()}-${String(inTwoMonths.getMonth() + 1).padStart(2, '0')}-${String(inTwoMonths.getDate()).padStart(2, '0')}`,
    location: 'Lisboa, Portugal',
    federation: 'IBJJF',
  });

  // 10. Marketplace product — no createdBy column in the schema.
  await db.insert(schema.product).values({
    academyId: acad.id,
    name: 'Kimono Academia Demo',
    description: 'Kimono oficial da Academia Demo PGT',
    price: '450.00',
    stock: 10,
  });
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
