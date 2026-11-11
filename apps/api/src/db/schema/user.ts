import { pgTable, uuid, varchar, date, timestamp, boolean, pgEnum, text, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { academy } from './academy';
import { family } from './family';

// IBJJF order: kids belts (grey/yellow/orange/green, each with white/black variants), then adult belts.
export const beltEnum = pgEnum('belt', [
  'white',
  'grey-white', 'grey', 'grey-black',
  'yellow-white', 'yellow', 'yellow-black',
  'orange-white', 'orange', 'orange-black',
  'green-white', 'green', 'green-black',
  'blue', 'purple', 'brown', 'black',
]);
// responsible = logs in only to manage a Family, doesn't train (ADR 0004).
export const userRoleEnum = pgEnum('user_role', ['student', 'owner', 'responsible']);
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
  // Class Add-on: set while the Owner has the Student marked, to the Payout Teacher who gets its share.
  // ponytail: a current flag, not a history — un-marking also drops the add-on from older unpaid months.
  addOnTeacherId: uuid('add_on_teacher_id').references((): AnyPgColumn => user.id),
  // Recruited Student: the Payout Teacher who brought them ("Angariado por").
  recruitedById: uuid('recruited_by_id').references((): AnyPgColumn => user.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
