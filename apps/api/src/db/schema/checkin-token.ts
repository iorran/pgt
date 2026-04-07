import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { bjjClass } from './class';

export const checkinToken = pgTable('checkin_token', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id').notNull().references(() => bjjClass.id),
  token: varchar('token', { length: 100 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('checkin_token_token_idx').on(table.token),
]);
