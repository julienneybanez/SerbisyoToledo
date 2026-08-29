// Canonical migration runner for the Canonical DB V3.1 schema.
//
// Usage:
//   node scripts/migrate.js            # apply all pending migrations
//   node scripts/migrate.js --dry-run  # list pending migrations without running them
//
// This runner treats the `schema_migrations` table (created by
// 0000_baseline_canonical_schema.sql) as the single source of truth for
// which migration files have already been applied to a given database. It
// walks the migrations/ directory in filename order and executes every
// .sql file that is not yet recorded in `schema_migrations`.
//
// IMPORTANT — starting point for any NEW database:
// Only `0000_baseline_canonical_schema.sql` should be applied to a fresh,
// empty schema. All dated migration files (20260725_*, 20260801_*,
// 20260807_*, 20260808_*, 20260809_*, 20260829_*) are historical, incremental
// steps that were applied to the OLD pre-canonical production schema over
// time; their cumulative effect is already fully captured by the 0000
// baseline. They are kept in this directory for historical record only and
// are NOT intended to be re-applied on top of the canonical baseline. This
// runner does not skip them automatically — operators are responsible for
// only pointing it at a fresh database when using the baseline-only path.
//
// This script never runs automatically and must be invoked explicitly.
// It has not been executed against any real database in this environment
// (no local MySQL instance is available); review its logic carefully
// before running it against any live database, and never point it at
// Production.

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

function getConnectionConfig() {
  const databaseUrl = process.env.MYSQL_PUBLIC_URL || process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.DB_URL;

  if (databaseUrl) {
    return {
      uri: databaseUrl,
      multipleStatements: true,
      ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false },
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'serbisyo_toledo',
    multipleStatements: true,
  };
}

function listMigrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql') && !name.endsWith('.rollback.sql'))
    .sort();
}

async function schemaMigrationsTableExists(connection) {
  const [tables] = await connection.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'schema_migrations'`,
    [process.env.DB_NAME || 'serbisyo_toledo']
  );
  return tables.length > 0;
}

async function getApplicationTableNames(connection) {
  const [tables] = await connection.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES 
     WHERE TABLE_SCHEMA = ? 
     AND TABLE_NAME NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')`,
    [process.env.DB_NAME || 'serbisyo_toledo']
  );
  return tables.map((row) => row.TABLE_NAME);
}

async function getAppliedFilenames(connection) {
  const [rows] = await connection.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((row) => row.filename));
}

async function bootstrapDatabase(connection) {
  // STATE A: Completely empty schema (no tables)
  // STATE C: Application tables exist but no schema_migrations
  // STATE D: schema_migrations exists but baseline missing
  
  const schemaExists = await schemaMigrationsTableExists(connection);
  const appTables = await getApplicationTableNames(connection);
  
  if (!schemaExists) {
    if (appTables.length > 0) {
      // STATE C: Application tables exist without schema_migrations
      throw new Error(
        `BOOTSTRAP ERROR (State C):\n` +
        `Database contains application tables but schema_migrations table not found.\n` +
        `This indicates a partially-initialized or legacy schema.\n` +
        `Cannot proceed without risking data loss or schema mismatch.\n` +
        `\n` +
        `Tables found: ${appTables.join(', ')}\n` +
        `\n` +
        `Options:\n` +
        `  1. Restore database from a clean backup\n` +
        `  2. Manually verify database state and create schema_migrations table\n` +
        `  3. Contact database administrator\n`
      );
    }
    
    // STATE A: Empty schema, baseline permitted
    console.log('✓ STATE A: Fresh database detected (no tables, no schema_migrations)');
    console.log('  Baseline migration (0000_baseline_canonical_schema.sql) will be permitted.');
    
    // Create schema_migrations table (will be filled by baseline)
    await connection.query(`
      CREATE TABLE schema_migrations (
        id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        filename    VARCHAR(255)    NOT NULL,
        applied_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_schema_migrations_filename (filename)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    return true; // Proceed with migrations (baseline first)
  }
  
  // STATE B or D: schema_migrations table exists
  // Check if baseline record is present
  const [baselineRecords] = await connection.query(
    `SELECT filename FROM schema_migrations WHERE filename = '0000_baseline_canonical_schema.sql'`
  );
  
  if (baselineRecords.length === 0) {
    // STATE D: schema_migrations exists but baseline missing
    throw new Error(
      `BOOTSTRAP ERROR (State D):\n` +
      `schema_migrations table exists but baseline record not found.\n` +
      `This indicates the baseline schema was not applied or was partially applied.\n` +
      `\n` +
      `The baseline (0000_baseline_canonical_schema.sql) must be the first recorded migration.\n` +
      `Cannot determine if the canonical schema is fully present.\n` +
      `\n` +
      `Options:\n` +
      `  1. Restore database from a clean backup and re-run this migration script\n` +
      `  2. Manually verify that all baseline tables exist and update schema_migrations\n` +
      `  3. Contact database administrator\n`
    );
  }
  
  // STATE B: schema_migrations exists with baseline record
  console.log('✓ STATE B: Canonical database detected (schema_migrations with baseline record present)');
  return true; // Proceed with pending migrations
}

async function run() {
  const isDryRun = process.argv.includes('--dry-run');
  const allFiles = listMigrationFiles();

  let connection;
  try {
    connection = await mysql.createConnection(getConnectionConfig());
    
    // Bootstrap and detect database state
    await bootstrapDatabase(connection);
    
    // Get applied migrations
    const applied = await getAppliedFilenames(connection);
    const pending = allFiles.filter((filename) => !applied.has(filename));

    if (pending.length === 0) {
      console.log('✓ No pending migrations. Database is up to date.');
      return;
    }

    console.log(`\nPending migrations (${pending.length}):`);
    pending.forEach((filename) => console.log(`  - ${filename}`));

    if (isDryRun) {
      console.log('\n--dry-run: no migrations were executed.');
      return;
    }

    console.log(`\nApplying ${pending.length} pending migration(s)...`);
    for (const filename of pending) {
      const filePath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`\n  Applying ${filename}...`);
      await connection.query(sql);

      // INSERT IGNORE: some migration files (e.g. the 0000 baseline) already
      // record themselves in schema_migrations as their final statement.
      await connection.query(
        'INSERT IGNORE INTO schema_migrations (filename) VALUES (?)',
        [filename]
      );

      console.log(`  ✅ ${filename} applied successfully`);
    }

    console.log('\n✅ All pending migrations applied successfully.');
  } catch (error) {
    console.error('❌ Migration run failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

run();
