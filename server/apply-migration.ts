import { Database } from 'bun:sqlite';
import { readFileSync } from 'fs';
import { join } from 'path';

const dbPath = process.env.DATABASE_URL || 'family.sqlite';
console.log(`Migrating database at ${dbPath}...`);

const db = new Database(dbPath);

try {
    // Enable DELETE mode for Azure Files compatibility (WAL requires mmap which is flaky on CIFS/SMB)
    db.run('PRAGMA journal_mode = DELETE;');

    // Read migration file
    const migrationPath = join(import.meta.dir, 'src', 'db', 'migrations', '001_multi_user_schema.sql');
    const migrationSql = readFileSync(migrationPath, 'utf-8');
    console.log('--- MIGRATION SQL PREVIEW ---');
    console.log(migrationSql.substring(0, 200));
    console.log('-----------------------------');

    // Execute migration
    const statements = migrationSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    console.log(`Found ${statements.length} statements to execute.`);

    const deploy = db.transaction((stmts) => {
        for (const stmt of stmts) {
            console.log('Executing statement:', stmt.substring(0, 50) + '...');
            db.run(stmt);
        }
    });

    deploy(statements);

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
