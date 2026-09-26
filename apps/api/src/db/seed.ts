import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { db } from './client.js';
import { academy, user, membershipPlan, studentMembership, badgeDefinition } from './schema/index.js';
import { auth } from '../auth/index.js';
import { parseRoster, normalizeName } from './roster-csv.js';

// Student roster export. Contains personal data (phones, minors) and the repo is
// public, so it lives in the gitignored seed-data/ folder, never in git.
const ROSTER_CSV = process.env.SEED_CSV || 'seed-data/roster.csv';

const isLocalDb = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? '');

// Owner login. Locally the password is the email (admin@admin.com / admin@admin.com);
// against any remote DB a real password must be passed via SEED_ADMIN_PASSWORD.
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@admin.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || (isLocalDb ? ADMIN_EMAIL : undefined);
// Test student login, same rule: skipped on a remote DB unless SEED_STUDENT_PASSWORD is set.
const STUDENT_EMAIL = 'aluno@aluno.com';
const STUDENT_PASSWORD = process.env.SEED_STUDENT_PASSWORD || (isLocalDb ? STUDENT_EMAIL : undefined);

const slugify = (s: string) => normalizeName(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function seed() {
  if (!ADMIN_PASSWORD) {
    throw new Error('Remote DATABASE_URL: set SEED_ADMIN_PASSWORD (and optionally SEED_ADMIN_EMAIL)');
  }
  console.log('Seeding database...');

  const [acad] = await db.insert(academy).values({
    name: 'PGT Pontinha',
    slug: 'pgt-pontinha',
    joinCode: 'PGT-PONTINHA',
    city: 'Pontinha',
  }).returning();

  // Creates a login-capable user (better-auth credential account + hashed password),
  // then patches academy/role/status/belt which sign-up does not set.
  async function createLogin(email: string, password: string, name: string, role: 'owner' | 'student', belt: 'white' | 'blue' | 'black') {
    await auth.api.signUpEmail({ body: { email, password, name } });
    const [u] = await db
      .update(user)
      .set({ academyId: acad.id, role, status: 'active', belt })
      .where(eq(user.email, email))
      .returning();
    return u;
  }

  const admin = await createLogin(ADMIN_EMAIL, ADMIN_PASSWORD, 'Admin', 'owner', 'black');
  await db.update(academy).set({ ownerId: admin.id }).where(eq(academy.id, acad.id));
  const aluno = STUDENT_PASSWORD ? await createLogin(STUDENT_EMAIL, STUDENT_PASSWORD, 'Aluno Teste', 'student', 'blue') : null;

  // Billing starts next month: the sheet has no reliable payment history, so starting
  // at the join month would flag everyone overdue for every month since.
  const now = new Date();
  const billingStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);

  if (existsSync(ROSTER_CSV)) {
    const roster = parseRoster(readFileSync(ROSTER_CSV, 'utf8'));

    // One monthly plan per distinct fee in the sheet.
    const prices = [...new Set(roster.map((s) => s.price))].sort((a, b) => Number(a) - Number(b));
    const plans = await db.insert(membershipPlan).values(prices.map((price) => ({
      academyId: acad.id,
      name: Number(price) === 0 ? 'Isento' : `Mensalidade ${Number(price)} €`,
      price,
      frequency: 'monthly' as const,
    }))).returning();
    const planByPrice = new Map(plans.map((p) => [p.price, p.id]));

    // No emails in the sheet: placeholder addresses, no login. Owner replaces them later.
    const usedEmails = new Set<string>();
    const students = await db.insert(user).values(roster.map((s) => {
      const base = slugify(s.name) || 'aluno';
      let email = `${base}@pgt-pontinha.local`;
      for (let n = 2; usedEmails.has(email); n++) {
        email = `${base}-${n}@pgt-pontinha.local`;
      }
      usedEmails.add(email);
      return {
        academyId: acad.id,
        email,
        name: s.name,
        phone: s.phone,
        role: 'student' as const,
        status: 'active' as const,
        createdAt: new Date(Date.UTC(2026, s.joinMonth - 1, 1)),
      };
    })).returning({ id: user.id });

    // Muted because placeholder emails can't receive overdue notices.
    await db.insert(studentMembership).values(roster.map((s, i) => ({
      studentId: students[i].id,
      planId: planByPrice.get(s.price)!,
      startDate: billingStart,
      dueDay: 8,
      notificationsMuted: true,
    })));
    if (aluno) {
      await db.insert(studentMembership).values({
        studentId: aluno.id, planId: planByPrice.get('45.00') ?? plans[0].id, startDate: billingStart, dueDay: 8,
      });
    }
    console.log(`Imported ${roster.length} students, ${plans.length} plans from ${ROSTER_CSV}`);
  } else {
    console.warn(`No roster at ${ROSTER_CSV}; seeded academy + owner only`);
  }

  await db.insert(badgeDefinition).values([
    { academyId: acad.id, name: '100 Aulas', description: 'Completou 100 aulas', icon: '💯', criteriaType: 'classes_count', criteriaValue: 100 },
    { academyId: acad.id, name: 'Primeira Competição', description: 'Competiu pela primeira vez', icon: '🥋', criteriaType: 'first_competition', criteriaValue: 1 },
    { academyId: acad.id, name: 'Mês Perfeito', description: 'Treinou todas as semanas do mês', icon: '🔥', criteriaType: 'perfect_month', criteriaValue: 4 },
  ]);

  console.log('Seed complete!');
  process.exit(0);
}

seed().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
