import { pgTable, uuid, varchar, decimal, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { academy } from './academy';

// An Expense: money the academy spent in a month (YYYY-MM).
export const expense = pgTable('expense', {
  id: uuid('id').primaryKey().defaultRandom(),
  academyId: uuid('academy_id').notNull().references(() => academy.id),
  month: varchar('month', { length: 7 }).notNull(),
  description: varchar('description', { length: 255 }).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  // "Só este mês": not copied into the next month.
  oneOff: boolean('one_off').default(false).notNull(),
  // False on rows copied from an earlier month until the Owner edits or confirms the value.
  confirmed: boolean('confirmed').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('expense_academy_month_idx').on(t.academyId, t.month)]);
