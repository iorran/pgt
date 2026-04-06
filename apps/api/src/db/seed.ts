import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from './client.js';
import { academy, user, bjjClass, membershipPlan, badgeDefinition, season } from './schema/index.js';

async function seed() {
  console.log('Seeding database...');

  // Academy
  const [acad] = await db.insert(academy).values({
    name: 'Alliance São Paulo',
    slug: 'alliance-sp',
    joinCode: 'ALLIANCE-SP-TEST',
    city: 'São Paulo',
  }).returning();

  // Instructor
  const [instructor] = await db.insert(user).values({
    academyId: acad.id,
    email: 'professor@alliance.com',
    name: 'Professor Silva',
    role: 'instructor',
    belt: 'black',
    dateOfBirth: '1985-03-15',
    status: 'active',
  }).returning();

  // Set academy owner to instructor
  await db.update(academy).set({ ownerId: instructor.id }).where(eq(academy.id, acad.id));

  // Students
  const students = await db.insert(user).values([
    { academyId: acad.id, email: 'joao@test.com', name: 'João Santos', role: 'student' as const, belt: 'blue' as const, dateOfBirth: '1995-06-20', status: 'active' as const },
    { academyId: acad.id, email: 'maria@test.com', name: 'Maria Oliveira', role: 'student' as const, belt: 'purple' as const, dateOfBirth: '1992-11-10', status: 'active' as const },
    { academyId: acad.id, email: 'pedro@test.com', name: 'Pedro Junior', role: 'student' as const, belt: 'white' as const, dateOfBirth: '2013-08-05', status: 'active' as const },
  ]).returning();

  // Classes
  await db.insert(bjjClass).values([
    { academyId: acad.id, instructorId: instructor.id, name: 'Gi Manhã', type: 'gi' as const, recurrence: 'weekly' as const, dayOfWeek: 1, startTime: '07:00', endTime: '08:30' },
    { academyId: acad.id, instructorId: instructor.id, name: 'No-Gi Noite', type: 'no-gi' as const, recurrence: 'weekly' as const, dayOfWeek: 3, startTime: '19:00', endTime: '20:30' },
    { academyId: acad.id, instructorId: instructor.id, name: 'Kids', type: 'kids' as const, recurrence: 'weekly' as const, dayOfWeek: 6, startTime: '10:00', endTime: '11:00' },
  ]);

  // Membership Plans
  await db.insert(membershipPlan).values([
    { academyId: acad.id, name: 'Mensal Ilimitado', price: '250.00', frequency: 'monthly' as const, classesPerWeek: null },
    { academyId: acad.id, name: '2x por Semana', price: '180.00', frequency: 'monthly' as const, classesPerWeek: 2 },
    { academyId: acad.id, name: 'Aula Avulsa', price: '50.00', frequency: 'monthly' as const, classesPerWeek: 1 },
  ]);

  // Season
  await db.insert(season).values({
    academyId: acad.id,
    name: 'Ranking 2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    pointsConfig: { 1: 10, 2: 7, 3: 5 },
    prizeDescription: 'Gi novo da Shoyoroll',
    active: true,
  });

  // Badge Definitions
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
