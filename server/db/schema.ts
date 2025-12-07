import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const people = sqliteTable('people', {
  id: text('id').primaryKey(), // UUID
  firstName: text('first_name'),
  middleName: text('middle_name'),
  lastName: text('last_name'),
  nickname: text('nickname'),
  gender: text('gender'), // 'male', 'female', 'other'
  birthDate: text('birth_date'),
  deathDate: text('death_date'),
  notes: text('notes'),
  profileImage: text('profile_image'), // Base64 string
  attributes: text('attributes', { mode: 'json' }), // JSON string for extra data
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const events = sqliteTable('events', {
  id: text('id').primaryKey(), // UUID
  personId: text('person_id').references(() => people.id, { onDelete: 'cascade' }),
  type: text('type'), // 'birth', 'death', 'marriage', 'graduation', etc.
  date: text('date'),
  place: text('place'),
  description: text('description'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const relationships = sqliteTable('relationships', {
  id: text('id').primaryKey(), // UUID
  fromPersonId: text('from_person_id').references(() => people.id),
  toPersonId: text('to_person_id').references(() => people.id),
  type: text('type').notNull(), // 'parent', 'spouse'
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});
