import { pgTable, uuid, timestamp, index } from 'drizzle-orm/pg-core';
import { bjjClass } from './class';
import { user } from './user';

export const checkin = pgTable('checkin', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id').notNull().references(() => bjjClass.id),
  studentId: uuid('student_id').notNull().references(() => user.id),
  checkedInAt: timestamp('checked_in_at').defaultNow().notNull(),
}, (table) => [
  index('checkin_student_date_idx').on(table.studentId, table.checkedInAt),
  index('checkin_class_idx').on(table.classId),
]);
