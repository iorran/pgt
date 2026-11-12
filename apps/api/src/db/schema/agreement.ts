import { pgTable, uuid, varchar, decimal, integer, boolean, timestamp, primaryKey, pgEnum } from 'drizzle-orm/pg-core';
import { academy } from './academy';
import { user } from './user';

// A Teacher Agreement (ADR 0006): the Owner's deal with one or more Class Teachers to pass on a share of
// what Students pay. One percentage for Recruited Students' Monthly Fee and for its Class Add-on.
export const teacherAgreement = pgTable('teacher_agreement', {
  id: uuid('id').primaryKey().defaultRandom(),
  academyId: uuid('academy_id').notNull().references(() => academy.id),
  name: varchar('name', { length: 50 }).notNull(),
  sharePercent: integer('share_percent').notNull(),
  // Class Add-on per month; null = the agreement offers none.
  addOnPrice: decimal('add_on_price', { precision: 10, scale: 2 }),
  // False once the Owner ends it: no new links, its Students are unlinked.
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const agreementTeacher = pgTable(
  'agreement_teacher',
  {
    agreementId: uuid('agreement_id')
      .notNull()
      .references(() => teacherAgreement.id, { onDelete: 'cascade' }),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => user.id),
  },
  (t) => [primaryKey({ columns: [t.agreementId, t.teacherId] })],
);

// How a Student is linked to their (at most one) Teacher Agreement.
export const agreementKindEnum = pgEnum('agreement_kind', ['addOn', 'recruited']);
