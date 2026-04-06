import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const academy = pgTable('academy', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  joinCode: varchar('join_code', { length: 50 }).unique(),
  city: varchar('city', { length: 255 }),
  ownerId: uuid('owner_id'),
  logoUrl: varchar('logo_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
