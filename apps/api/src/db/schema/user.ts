import { pgTable, uuid, varchar, date, timestamp, boolean, pgEnum, text, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { academy } from './academy';
import { family } from './family';

export const beltEnum = pgEnum('belt', ['white', 'blue', 'purple', 'brown', 'black']);
export const userRoleEnum = pgEnum('user_role', ['student', 'owner']);
export const userStatusEnum = pgEnum('user_status', ['pending', 'active', 'rejected']);

export const user = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  academyId: uuid('academy_id').references(() => academy.id),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  dateOfBirth: date('date_of_birth'),
  belt: beltEnum('belt').default('white').notNull(),
  role: userRoleEnum('role').default('student').notNull(),
  status: userStatusEnum('status').default('active').notNull(),
  image: varchar('image', { length: 500 }),
  // A student belongs to at most one family.
  // Free text for what modalities don't capture (e.g. "trânsito livre").
  trainingNote: text('training_note'),
  familyId: uuid('family_id').references((): AnyPgColumn => family.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
