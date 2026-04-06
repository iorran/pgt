import { pgTable, uuid, varchar, date, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { academy } from './academy';

export const beltEnum = pgEnum('belt', ['white', 'blue', 'purple', 'brown', 'black']);
export const userRoleEnum = pgEnum('user_role', ['instructor', 'student']);
export const userStatusEnum = pgEnum('user_status', ['pending', 'active', 'rejected']);

export const user = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  academyId: uuid('academy_id').references(() => academy.id),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: timestamp('email_verified'),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  dateOfBirth: date('date_of_birth'),
  belt: beltEnum('belt').default('white').notNull(),
  role: userRoleEnum('role').default('student').notNull(),
  status: userStatusEnum('status').default('active').notNull(),
  image: varchar('image', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
