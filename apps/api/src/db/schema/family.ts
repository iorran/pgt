import { pgTable, uuid, varchar, decimal, date, timestamp, text, unique, uniqueIndex, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { academy } from './academy';
import { user } from './user';

// Students of one household who pay together (see docs/CONTEXT.md "Family").
export const family = pgTable('family', {
  id: uuid('id').primaryKey().defaultRandom(),
  academyId: uuid('academy_id').notNull().references(() => academy.id),
  name: varchar('name', { length: 255 }).notNull(),
  // The one login that acts for every member (ADR 0004). Always set on active families;
  // soft-deleted families may have none.
  responsibleUserId: uuid('responsible_user_id').references((): AnyPgColumn => user.id),
  agreedPrice: decimal('agreed_price', { precision: 10, scale: 2 }),
  // Set when members change while an agreed price exists; cleared when the owner saves the price again.
  priceReviewNeeded: timestamp('price_review_needed'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  // Soft delete: family payments keep pointing here after the owner removes the family.
  deletedAt: timestamp('deleted_at'),
}, (t) => [uniqueIndex('family_responsible_active_uq').on(t.responsibleUserId).where(sql`${t.deletedAt} is null`)]);

// One payment by a family covering whole months; per-member rows live in `payment` (ADR 0001).
export const familyPayment = pgTable('family_payment', {
  id: uuid('id').primaryKey().defaultRandom(),
  familyId: uuid('family_id').notNull().references(() => family.id),
  academyId: uuid('academy_id').notNull().references(() => academy.id),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  paymentDate: date('payment_date').notNull(),
  months: varchar('months', { length: 7 }).array().notNull(),
  recordedBy: uuid('recorded_by').notNull().references(() => user.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// A month the owner decided a student does not owe.
export const waivedMonth = pgTable('waived_month', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => user.id),
  // The academy that waived it: a student who moves academy starts with none at the new one.
  academyId: uuid('academy_id').notNull().references(() => academy.id),
  referenceMonth: varchar('reference_month', { length: 7 }).notNull(),
  reason: text('reason'),
  createdBy: uuid('created_by').notNull().references(() => user.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [unique('waived_month_student_academy_month_uq').on(t.studentId, t.academyId, t.referenceMonth)]);

// "Possíveis famílias" the owner dismissed, keyed by the shared phone number.
export const familySuggestionDismissal = pgTable('family_suggestion_dismissal', {
  id: uuid('id').primaryKey().defaultRandom(),
  academyId: uuid('academy_id').notNull().references(() => academy.id),
  phone: varchar('phone', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [unique('family_suggestion_dismissal_uq').on(t.academyId, t.phone)]);
