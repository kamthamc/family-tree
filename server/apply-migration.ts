import { Database } from 'bun:sqlite';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const dbPath = process.env.DATABASE_URL || 'family.sqlite';
console.log(`Migrating database at ${dbPath}...`);

const db = new Database(dbPath);

try {
    // Enable DELETE mode for Azure Files compatibility
    db.run('PRAGMA journal_mode = DELETE;');

    // 1. Create migrations table if not exists
    db.run(`
        CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            applied_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 2. Get applied migrations
    const result = db.query('SELECT name FROM _migrations').all();
    const appliedMigrations = new Set(result.map((row: any) => row.name));

    // 3. Read migration files
    const migrationsDir = join(import.meta.dir, 'src', 'db', 'migrations');
    const files = readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort(); // Ensure order by filename (001, 002, etc.)

    console.log(`Found ${files.length} migration files.`);

    const newMigrations = files.filter(f => !appliedMigrations.has(f));

    if (newMigrations.length === 0) {
        console.log('Database is up to date.');
    } else {
        console.log(`Found ${newMigrations.length} new migrations to apply.`);

        // 4. Apply new migrations
        const deploy = db.transaction((file: string) => {
            console.log(`Applying migration: ${file}...`);
            const path = join(migrationsDir, file);
            const sql = readFileSync(path, 'utf-8');

            // Split by statement (basic implementation, might split inside strings but usually fine for simple migrations)
            // Better: just run file content? SQLite usually supports executing script? 
            // Bun SQLite .run() usually runs one statement. .exec() or .run() with script?
            // Bun Database has .exec() which runs a script. Let's try that or split manually if needed.
            // Actually bun:sql doesn't have .exec() documented extensively for scripts, so splitting is safer for now.
            const statements = sql
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            for (const stmt of statements) {
                // Skip comments if strictly needed but basic trim works usually
                db.run(stmt);
            }

            db.run('INSERT INTO _migrations (name) VALUES (?)', [file]);
        });

        for (const file of newMigrations) {
            deploy(file);
        }

        console.log('All migrations applied successfully!');
    }

} catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
} finally {
    db.close();
}

