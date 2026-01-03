import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
  encryptionSalt: text('encryption_salt').notNull(),
  encryptedUserKey: text('encrypted_user_key').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Family Trees table
export const familyTrees = sqliteTable('family_trees', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Permissions table
export const permissions = sqliteTable('permissions', {
  id: text('id').primaryKey(),
  familyTreeId: text('family_tree_id').notNull().references(() => familyTrees.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'owner', 'editor', 'viewer'
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// People table (with encryption)
export const people = sqliteTable('people', {
  id: text('id').primaryKey(),
  familyTreeId: text('family_tree_id').notNull().references(() => familyTrees.id, { onDelete: 'cascade' }),
  // Encrypted fields
  encryptedFirstName: text('encrypted_first_name'),
  encryptedMiddleName: text('encrypted_middle_name'),
  encryptedLastName: text('encrypted_last_name'),
  encryptedNickname: text('encrypted_nickname'),
  encryptedBirthDate: text('encrypted_birth_date'),
  encryptedDeathDate: text('encrypted_death_date'),
  encryptedNotes: text('encrypted_notes'),
  encryptedAddress: text('encrypted_address'),
  encryptedPhone: text('encrypted_phone'),
  // Non-sensitive fields
  gender: text('gender'),
  profileImage: text('profile_image'),
  attributes: text('attributes', { mode: 'json' }),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Events table (with encryption)
export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  personId: text('person_id').references(() => people.id, { onDelete: 'cascade' }),
  type: text('type'),
  encryptedDate: text('encrypted_date'),
  encryptedPlace: text('encrypted_place'),
  encryptedDescription: text('encrypted_description'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Relationships table
export const relationships = sqliteTable('relationships', {
  id: text('id').primaryKey(),
  familyTreeId: text('family_tree_id').notNull().references(() => familyTrees.id, { onDelete: 'cascade' }),
  fromPersonId: text('from_person_id').references(() => people.id, { onDelete: 'cascade' }),
  toPersonId: text('to_person_id').references(() => people.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});
