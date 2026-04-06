import { pgTable, uuid, varchar, date, integer, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { season } from './season';
import { user } from './user';

export const resultStatusEnum = pgEnum('result_status', ['pending', 'approved', 'rejected']);

export const competitionResult = pgTable('competition_result', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => season.id),
  studentId: uuid('student_id').notNull().references(() => user.id),
  competitionName: varchar('competition_name', { length: 255 }).notNull(),
  competitionDate: date('competition_date').notNull(),
  position: integer('position').notNull(),
  pointsAwarded: integer('points_awarded').default(0).notNull(),
  status: resultStatusEnum('status').default('pending').notNull(),
  submittedBy: uuid('submitted_by').notNull().references(() => user.id),
  reviewedBy: uuid('reviewed_by').references(() => user.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('result_season_student_idx').on(table.seasonId, table.studentId, table.status),
]);
