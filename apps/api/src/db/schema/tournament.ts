import { pgTable, uuid, varchar, date, timestamp } from 'drizzle-orm/pg-core';
import { academy } from './academy';
import { user } from './user';

export const tournament = pgTable('tournament', {
  id: uuid('id').primaryKey().defaultRandom(),
  academyId: uuid('academy_id').notNull().references(() => academy.id),
  name: varchar('name', { length: 255 }).notNull(),
  date: date('date').notNull(),
  location: varchar('location', { length: 500 }),
  federation: varchar('federation', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tournamentSignup = pgTable('tournament_signup', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournament.id),
  studentId: uuid('student_id').notNull().references(() => user.id),
  weightClass: varchar('weight_class', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
