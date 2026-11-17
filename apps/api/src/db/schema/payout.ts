import { pgTable, uuid, varchar, decimal, boolean, timestamp, unique } from 'drizzle-orm/pg-core';
import { academy } from './academy';
import { user } from './user';

// A Payout Sheet (ADR 0007): what the academy passes on to the teachers of one class name for one month.
// Created on its first write; once confirmed it counts in the Monthly Balance.
export const payoutSheet = pgTable(
  'payout_sheet',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    academyId: uuid('academy_id')
      .notNull()
      .references(() => academy.id),
    className: varchar('class_name', { length: 255 }).notNull(),
    month: varchar('month', { length: 7 }).notNull(),
    confirmedAt: timestamp('confirmed_at'),
  },
  (t) => [unique('payout_sheet_academy_class_month_uq').on(t.academyId, t.className, t.month)],
);

// A Payout Line: the amount the Owner typed for one Student; null = nothing.
export const payoutLine = pgTable(
  'payout_line',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sheetId: uuid('sheet_id')
      .notNull()
      .references(() => payoutSheet.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => user.id),
    amount: decimal('amount', { precision: 10, scale: 2 }),
    // The Owner added the Student though they didn't check in.
    addedByHand: boolean('added_by_hand').default(false).notNull(),
  },
  (t) => [unique('payout_line_sheet_student_uq').on(t.sheetId, t.studentId)],
);
