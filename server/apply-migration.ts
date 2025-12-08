import { Database } from 'bun:sqlite';
import { readFileSync } from 'fs';
import { join } from 'path';

const dbPath = process.env.DATABASE_URL || 'family.sqlite';
console.log(`Migrating database at ${dbPath}...`);

const db = new Database(dbPath);

try {
    // Enable WAL mode for better concurrency
    db.exec('PRAGMA journal_mode = WAL;');

    // Read migration file
    const migrationPath = join(import.meta.dir, 'src', 'db', 'migrations', '001_multi_user_schema.sql');
    const migrationSql = readFileSync(migrationPath, 'utf-8');

    // Execute migration
    // SQLite doesn't support multiple statements in one exec call easily in some drivers,
    // but bun:sqlite might. Let's try splitting by semicolon if needed, 
    // but usually a script can be run if the driver supports it.
    // Bun's db.exec() executes all statements.

    db.exec(migrationSql);

    console.log('Migration completed successfully!');

    // Verify tables
    const tables = db.query(`SELECT name FROM sqlite_master WHERE type='table';`).all();
    console.log('Tables:', tables.map((t: any) => t.name));

} catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
} finally {
    db.close();
}
