import { pgTable, uuid, varchar, timestamp, decimal } from 'drizzle-orm/pg-core';

export const academy = pgTable('academy', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  joinCode: varchar('join_code', { length: 50 }).unique(),
  city: varchar('city', { length: 255 }),
  address: varchar('address', { length: 500 }),
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  ownerId: uuid('owner_id'),
  logoUrl: varchar('logo_url', { length: 500 }),
  timezone: varchar('timezone', { length: 64 }).notNull().default('Europe/Lisbon'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
