import { pgTable, uuid, decimal, date, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { user } from './user.js';
import { academy } from './academy.js';

export const payment = pgTable('payment', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => user.id),
  academyId: uuid('academy_id').notNull().references(() => academy.id),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  paymentDate: date('payment_date').notNull(),
  referenceMonth: varchar('reference_month', { length: 7 }).notNull(),
  recordedBy: uuid('recorded_by').notNull().references(() => user.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('payment_student_month_idx').on(table.studentId, table.referenceMonth),
]);
