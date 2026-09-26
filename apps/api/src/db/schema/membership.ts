import { pgTable, uuid, decimal, integer, boolean, date, timestamp } from 'drizzle-orm/pg-core';
import { user } from './user';

export const studentMembership = pgTable('student_membership', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => user.id),
  startDate: date('start_date').notNull(),
  dueDay: integer('due_day').notNull(),
  // What the student pays per month, set by the owner (ADR 0002).
  monthlyFee: decimal('monthly_fee', { precision: 10, scale: 2 }).notNull(),
  active: boolean('active').default(true).notNull(),
  notificationsMuted: boolean('notifications_muted').default(false).notNull(),
  lastOverdueEmailSentAt: timestamp('last_overdue_email_sent_at'),
});
