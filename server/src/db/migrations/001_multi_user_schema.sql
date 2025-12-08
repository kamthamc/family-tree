-- Migration: Add multi-user support with encryption
-- This migration adds users, family_trees, and permissions tables
-- and updates existing tables to support multi-tenancy and encryption

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  email_verified INTEGER DEFAULT 0,
  encryption_salt TEXT NOT NULL,
  encrypted_user_key TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create family_trees table
CREATE TABLE IF NOT EXISTS family_trees (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  family_tree_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (family_tree_id) REFERENCES family_trees(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Rename existing people table
ALTER TABLE people RENAME TO people_old;

-- Create new people table with encryption
CREATE TABLE people (
  id TEXT PRIMARY KEY,
  family_tree_id TEXT NOT NULL,
  encrypted_first_name TEXT,
  encrypted_middle_name TEXT,
  encrypted_last_name TEXT,
  encrypted_nickname TEXT,
  encrypted_birth_date TEXT,
  encrypted_death_date TEXT,
  encrypted_notes TEXT,
  gender TEXT,
  profile_image TEXT,
  attributes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (family_tree_id) REFERENCES family_trees(id) ON DELETE CASCADE
);

-- Rename existing events table
ALTER TABLE events RENAME TO events_old;

-- Create new events table with encryption
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  person_id TEXT,
  type TEXT,
  encrypted_date TEXT,
  encrypted_place TEXT,
  encrypted_description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);

-- Rename existing relationships table
ALTER TABLE relationships RENAME TO relationships_old;

-- Create new relationships table with family_tree_id
CREATE TABLE relationships (
  id TEXT PRIMARY KEY,
  family_tree_id TEXT NOT NULL,
  from_person_id TEXT,
  to_person_id TEXT,
  type TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (family_tree_id) REFERENCES family_trees(id) ON DELETE CASCADE,
  FOREIGN KEY (from_person_id) REFERENCES people(id) ON DELETE CASCADE,
  FOREIGN KEY (to_person_id) REFERENCES people(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_family_trees_owner ON family_trees(owner_id);
CREATE INDEX idx_permissions_family_tree ON permissions(family_tree_id);
CREATE INDEX idx_permissions_user ON permissions(user_id);
CREATE INDEX idx_people_family_tree ON people(family_tree_id);
CREATE INDEX idx_events_person ON events(person_id);
CREATE INDEX idx_relationships_family_tree ON relationships(family_tree_id);
CREATE INDEX idx_relationships_from ON relationships(from_person_id);
CREATE INDEX idx_relationships_to ON relationships(to_person_id);

-- Note: Data migration from old tables to new tables should be done separately
-- with a migration script that:
-- 1. Creates a default user
-- 2. Creates a default family tree
-- 3. Encrypts existing data
-- 4. Migrates to new tables
-- 5. Drops old tables
