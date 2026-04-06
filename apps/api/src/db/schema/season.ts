import { pgTable, uuid, varchar, date, jsonb, boolean, text } from 'drizzle-orm/pg-core';
import { academy } from './academy';

export const season = pgTable('season', {
  id: uuid('id').primaryKey().defaultRandom(),
  academyId: uuid('academy_id').notNull().references(() => academy.id),
  name: varchar('name', { length: 255 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  pointsConfig: jsonb('points_config').notNull().$type<Record<number, number>>(),
  prizeDescription: text('prize_description'),
  active: boolean('active').default(true).notNull(),
});
