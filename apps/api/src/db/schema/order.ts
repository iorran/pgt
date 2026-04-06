import { pgTable, uuid, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { product } from './product.js';
import { user } from './user.js';

export const orderStatusEnum = pgEnum('order_status', ['requested', 'confirmed', 'delivered', 'cancelled']);

export const order = pgTable('order', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => product.id),
  studentId: uuid('student_id').notNull().references(() => user.id),
  quantity: integer('quantity').default(1).notNull(),
  status: orderStatusEnum('status').default('requested').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
