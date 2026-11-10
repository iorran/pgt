import { pgTable, uuid, varchar, decimal, date, timestamp, unique } from 'drizzle-orm/pg-core';
import { bjjClass } from './class';
import { user } from './user';

// A Seminar Participant: a Student (studentId) or an outsider known by name (ADR 0005).
export const seminarParticipant = pgTable('seminar_participant', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id').notNull().references(() => bjjClass.id),
  studentId: uuid('student_id').references(() => user.id),
  name: varchar('name', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  paidAt: date('paid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  unique('seminar_participant_class_student_uq').on(table.classId, table.studentId),
]);
