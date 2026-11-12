import { pgTable, uuid, varchar, date, timestamp, boolean, pgEnum, text, check, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { academy } from './academy';
import { family } from './family';
import { teacherAgreement, agreementKindEnum } from './agreement';

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
  // The Student's Teacher Agreement and how they are linked to it; both set or both null.
  // ponytail: a current link, not a history — past months are computed with today's links.
  agreementId: uuid('agreement_id').references((): AnyPgColumn => teacherAgreement.id),
  agreementKind: agreementKindEnum('agreement_kind'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [check('user_agreement_link_ck', sql`(${t.agreementId} IS NULL) = (${t.agreementKind} IS NULL)`)]);
