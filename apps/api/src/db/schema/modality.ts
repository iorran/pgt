import { pgTable, uuid, varchar, timestamp, primaryKey, unique } from 'drizzle-orm/pg-core';
import { academy } from './academy';
import { user } from './user';

// What every new academy starts with (migration 0010 seeds the same list for existing ones).
export const DEFAULT_MODALITIES = ['Jiu-Jitsu', 'MMA', 'Kids', 'Funcional', 'Feminino'];

// A discipline the academy teaches; students are tagged with what they train (informational only).
export const modality = pgTable('modality', {
  id: uuid('id').primaryKey().defaultRandom(),
  academyId: uuid('academy_id').notNull().references(() => academy.id),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [unique('modality_academy_name_uq').on(t.academyId, t.name)]);

export const studentModality = pgTable('student_modality', {
  studentId: uuid('student_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  modalityId: uuid('modality_id').notNull().references(() => modality.id),
}, (t) => [primaryKey({ columns: [t.studentId, t.modalityId] })]);
