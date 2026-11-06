//this file is to run the sql migrations in supabase.
// It will read the sql files in the migrations folder and run them in order.
// It will also keep track of which migrations have been run in the schema_migrations table.

import { readdir, readFile } from 'node:fs/promises';

import postgresPool, {
  closePostgresConnection,
} from './postgres.connection.js';

// Resolve the migrations directory relative to this file.
const migrationsDirectory = new URL('./migrations/', import.meta.url);

// A fixed lock ID prevents concurrent migration runs, which prevents creation of same tables.
const MIGRATION_LOCK_ID = 7142026;

async function runMigrations(){
  const client = await postgresPool.connect();
  let lockAcquired = false;

  try {
    // Prevent multiple migration processes from running together.
    await client.query(
      'SELECT pg_advisory_lock($1)',
      [MIGRATION_LOCK_ID]
    );
    lockAcquired = true;

    // Track migrations that have already been applied.
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Read and sort SQL migration files.
    const migrationFiles = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith('.sql'))
      .sort();

    if (migrationFiles.length === 0) {
      console.log('No migration files found.');
      return;
    }

    for (const file of migrationFiles) {
      const existingMigration = await client.query(
        'SELECT migration_name FROM schema_migrations WHERE migration_name = $1',
        [file]
      );

      if (existingMigration.rowCount > 0){
        console.log(`Already applied: ${file}`);
        continue;
      }

      const filePath = new URL(file, migrationsDirectory);
      const sql = await readFile(filePath, 'utf8');

      console.log(`Applying migration: ${file}`);

      try {
        await client.query('BEGIN');

        await client.query(sql);

        await client.query(
          'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
          [file]
        );

        await client.query('COMMIT');

        console.log(`Successfully applied: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration failed (${file}): ${error.message}`);
      }
    }

    console.log('Database migrations completed.');
  } finally {
    try {
      if (lockAcquired) {
        await client.query(
          'SELECT pg_advisory_unlock($1)',
          [MIGRATION_LOCK_ID]
        );
      }
    } finally {
      client.release();
    }
  }
}

async function main() {
  try {
    await runMigrations();
  } catch (error) {
    console.error('Migration runner failed:', error.message);
    process.exitCode = 1;
  } finally {
    await closePostgresConnection();
  }
}

main();