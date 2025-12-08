-- Initial Schema: Multi-user with encryption
-- This script initializes the database from scratch

-- 1. Users table
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

-- 2. Family Trees table
CREATE TABLE IF NOT EXISTS family_trees (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  family_tree_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (family_tree_id) REFERENCES family_trees(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. People table (Encrypted)
CREATE TABLE IF NOT EXISTS people (
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

-- 5. Events table (Encrypted)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  person_id TEXT,
  type TEXT,
  encrypted_date TEXT,
  encrypted_place TEXT,
  encrypted_description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);

-- 6. Relationships table
CREATE TABLE IF NOT EXISTS relationships (
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_family_trees_owner ON family_trees(owner_id);
CREATE INDEX IF NOT EXISTS idx_permissions_family_tree ON permissions(family_tree_id);
CREATE INDEX IF NOT EXISTS idx_permissions_user ON permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_people_family_tree ON people(family_tree_id);
CREATE INDEX IF NOT EXISTS idx_events_person ON events(person_id);
CREATE INDEX IF NOT EXISTS idx_relationships_family_tree ON relationships(family_tree_id);
CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships(from_person_id);
CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_person_id);
