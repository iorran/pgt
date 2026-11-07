import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from './client.js';
import { academy, user, studentMembership, badgeDefinition, modality, studentModality, season, family } from './schema/index.js';
import { auth } from '../auth/index.js';
import { parseRoster, normalizeName, DEFAULT_MODALITIES } from './roster-csv.js';
import { parseCleanRoster, planImport, isCleanRosterCsv } from './clean-roster.js';

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

// Staging: every real email (students and Responsibles) becomes a Gmail "+" alias of this address
// (me+1@gmail.com, me+2@…), so all mail lands in one inbox and no real person is ever contacted.
const EMAIL_ALIAS = process.env.SEED_EMAIL_ALIAS;

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

  const modalities = await db.insert(modality)
    .values(DEFAULT_MODALITIES.map((name) => ({ academyId: acad.id, name })))
    .returning();
  const modalityByName = new Map(modalities.map((m) => [m.name, m.id]));

  if (aluno) {
    await db.insert(studentMembership).values({ studentId: aluno.id, monthlyFee: '45.00', startDate: billingStart, dueDay: 8 });
  }

  if (existsSync(ROSTER_CSV)) {
    const text = readFileSync(ROSTER_CSV, 'utf8');
    if (isCleanRosterCsv(text)) {
      await importCleanRoster(text);
    } else {
      await importOldRoster(text);
    }
  } else {
    console.warn(`No roster at ${ROSTER_CSV}; seeded academy + owner only`);
  }

  // The reviewed roster (seed-data/2027-ativo.limpo.csv): one login per Family (ADR 0004).
  async function importCleanRoster(text: string) {
    const students = parseCleanRoster(text);
    const { families } = planImport(students);
    const [aliasLocal, aliasDomain] = (EMAIL_ALIAS ?? '').split('@');
    const aliases = new Map<string, string>();
    const realEmail = (email: string) => {
      if (!EMAIL_ALIAS) {
        return email;
      }
      if (!aliases.has(email)) {
        aliases.set(email, `${aliasLocal}+${aliases.size + 1}@${aliasDomain}`);
      }
      return aliases.get(email)!;
    };

    // Dependents never log in: a generated internal email only (Better Auth needs a unique one).
    const usedEmails = new Set<string>([ADMIN_EMAIL.toLowerCase()]);
    const rows = students.map((s) => {
      const id = randomUUID();
      // No own email (and not a Dependent): no login until the Owner adds one.
      const placeholder = `${id}@${s.dependent ? 'dependente' : 'sem-email'}.pgt.invalid`;
      let email = s.dependent || !s.email ? placeholder : realEmail(s.email);
      if (usedEmails.has(email)) {
        email = placeholder;
      }
      usedEmails.add(email);
      return {
        id,
        academyId: acad.id,
        email,
        name: s.name,
        phone: s.phone,
        dateOfBirth: s.dateOfBirth,
        belt: s.belt,
        trainingNote: s.trainingNote,
        role: 'student' as const,
        status: 'active' as const,
      };
    });
    await db.insert(user).values(rows);

    for (const f of families) {
      let responsibleUserId: string;
      if (f.responsible.kind === 'member') {
        const email = f.responsible.email;
        responsibleUserId = rows[f.memberIndexes.find((i) => students[i].email === email && !students[i].dependent)!].id;
      } else {
        const [r] = await db.insert(user).values({
          academyId: acad.id,
          email: realEmail(f.responsible.email),
          name: f.responsible.name,
          role: 'responsible',
          status: 'active',
        }).returning({ id: user.id });
        responsibleUserId = r.id;
      }
      const [fam] = await db.insert(family).values({ academyId: acad.id, name: f.name, responsibleUserId }).returning();
      for (const i of f.memberIndexes) {
        await db.update(user).set({ familyId: fam.id }).where(eq(user.id, rows[i].id));
      }
    }

    // Muted: fees and payment history aren't verified yet; the owner unmutes per student.
    await db.insert(studentMembership).values(students.map((s, i) => ({
      studentId: rows[i].id,
      monthlyFee: s.monthlyFee,
      startDate: billingStart,
      dueDay: 8,
      notificationsMuted: true,
    })));
    const tags = students.flatMap((s, i) => s.modalities.map((name) => ({ studentId: rows[i].id, modalityId: modalityByName.get(name)! })));
    if (tags.some((t) => !t.modalityId)) {
      throw new Error('Unknown modality in roster');
    }
    if (tags.length > 0) {
      await db.insert(studentModality).values(tags);
    }
    const responsibles = families.filter((f) => f.responsible.kind === 'new').length;
    console.log(`Imported ${students.length} students (${students.filter((s) => s.dependent).length} dependents), ${families.length} families, ${responsibles} Responsibles who don't train, from ${ROSTER_CSV}`);
  }

  // The older sheet export: no emails, no families.
  async function importOldRoster(text: string) {
    const roster = parseRoster(text);
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
        trainingNote: s.modalityText,
        role: 'student' as const,
        status: 'active' as const,
        createdAt: new Date(Date.UTC(2026, s.joinMonth - 1, 1)),
      };
    })).returning({ id: user.id });
    await db.insert(studentMembership).values(roster.map((s, i) => ({
      studentId: students[i].id,
      monthlyFee: s.price,
      startDate: billingStart,
      dueDay: 8,
      notificationsMuted: true,
    })));
    const tags = roster.flatMap((s, i) => s.modalities.map((name) => ({ studentId: students[i].id, modalityId: modalityByName.get(name)! })));
    if (tags.length > 0) {
      await db.insert(studentModality).values(tags);
    }
    console.log(`Imported ${roster.length} students from ${ROSTER_CSV}`);
  }

  // Same as a new academy created in the app: a season for the current year so results count.
  const year = new Date().getFullYear();
  await db.insert(season).values({
    academyId: acad.id,
    name: `Ranking ${year}`,
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    pointsConfig: { 1: 10, 2: 7, 3: 5 },
  });

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
