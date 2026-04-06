import { pgTable, uuid, varchar, text, integer, timestamp, date, pgEnum } from 'drizzle-orm/pg-core';
import { academy } from './academy';
import { user } from './user';

export const xpSourceTypeEnum = pgEnum('xp_source_type', ['checkin', 'competition', 'badge']);

export const badgeDefinition = pgTable('badge_definition', {
  id: uuid('id').primaryKey().defaultRandom(),
  academyId: uuid('academy_id').notNull().references(() => academy.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  icon: varchar('icon', { length: 255 }),
  criteriaType: varchar('criteria_type', { length: 100 }).notNull(),
  criteriaValue: integer('criteria_value').notNull(),
});

export const studentBadge = pgTable('student_badge', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => user.id),
  badgeDefinitionId: uuid('badge_definition_id').notNull().references(() => badgeDefinition.id),
  earnedAt: timestamp('earned_at').defaultNow().notNull(),
});

export const xpEntry = pgTable('xp_entry', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => user.id),
  xpAmount: integer('xp_amount').notNull(),
  sourceType: xpSourceTypeEnum('source_type').notNull(),
  sourceId: uuid('source_id'),
  earnedAt: timestamp('earned_at').defaultNow().notNull(),
});

export const streak = pgTable('streak', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => user.id).unique(),
  currentStreak: integer('current_streak').default(0).notNull(),
  longestStreak: integer('longest_streak').default(0).notNull(),
  lastCheckinWeek: date('last_checkin_week'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
