import { pgTable, uuid, varchar, decimal, integer, boolean, date, pgEnum } from 'drizzle-orm/pg-core';
import { academy } from './academy';
import { user } from './user';

export const planFrequencyEnum = pgEnum('plan_frequency', ['monthly', 'quarterly', 'yearly']);

export const membershipPlan = pgTable('membership_plan', {
  id: uuid('id').primaryKey().defaultRandom(),
  academyId: uuid('academy_id').notNull().references(() => academy.id),
  name: varchar('name', { length: 255 }).notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  frequency: planFrequencyEnum('frequency').notNull(),
  classesPerWeek: integer('classes_per_week'),
  active: boolean('active').default(true).notNull(),
});

export const studentMembership = pgTable('student_membership', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => user.id),
  planId: uuid('plan_id').notNull().references(() => membershipPlan.id),
  startDate: date('start_date').notNull(),
  dueDay: integer('due_day').notNull(),
  active: boolean('active').default(true).notNull(),
});
