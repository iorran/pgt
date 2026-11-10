import { pgTable, uuid, varchar, time, date, boolean, integer, pgEnum, decimal } from 'drizzle-orm/pg-core';
import { academy } from './academy';
import { user } from './user';

export const classTypeEnum = pgEnum('class_type', ['gi', 'no-gi', 'open-mat', 'kids']);
export const recurrenceEnum = pgEnum('recurrence', ['once', 'weekly']);

export const bjjClass = pgTable('class', {
  id: uuid('id').primaryKey().defaultRandom(),
  academyId: uuid('academy_id').notNull().references(() => academy.id),
  // Who created the class; the Class Teacher is teacherId / guestTeacherName.
  instructorId: uuid('instructor_id').notNull().references(() => user.id),
  teacherId: uuid('teacher_id').references(() => user.id),
  guestTeacherName: varchar('guest_teacher_name', { length: 255 }),
  isSeminar: boolean('is_seminar').default(false).notNull(),
  studentPrice: decimal('student_price', { precision: 10, scale: 2 }),
  outsiderPrice: decimal('outsider_price', { precision: 10, scale: 2 }),
  name: varchar('name', { length: 255 }).notNull(),
  type: classTypeEnum('type').notNull(),
  recurrence: recurrenceEnum('recurrence').notNull(),
  dayOfWeek: integer('day_of_week'),
  date: date('date'),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  active: boolean('active').default(true).notNull(),
});
