import { pgTable, uuid, timestamp, index, uniqueIndex, pgEnum, decimal } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { bjjClass } from './class';
import { user } from './user';

export const checkinSourceEnum = pgEnum('checkin_source', ['button', 'qr']);

export const checkin = pgTable('checkin', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id').notNull().references(() => bjjClass.id),
  studentId: uuid('student_id').notNull().references(() => user.id),
  source: checkinSourceEnum('source').notNull().default('button'),
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  checkedInAt: timestamp('checked_in_at').defaultNow().notNull(),
}, (table) => [
  index('checkin_student_date_idx').on(table.studentId, table.checkedInAt),
  index('checkin_class_idx').on(table.classId),
  uniqueIndex('checkin_class_student_day_idx').on(table.classId, table.studentId, sql`DATE(${table.checkedInAt})`),
]);
