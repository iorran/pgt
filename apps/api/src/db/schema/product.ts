import { pgTable, uuid, varchar, decimal, integer, boolean, text } from 'drizzle-orm/pg-core';
import { academy } from './academy.js';

export const product = pgTable('product', {
  id: uuid('id').primaryKey().defaultRandom(),
  academyId: uuid('academy_id').notNull().references(() => academy.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  photoUrl: varchar('photo_url', { length: 500 }),
  stock: integer('stock').default(0).notNull(),
  active: boolean('active').default(true).notNull(),
});
