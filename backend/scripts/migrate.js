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

async function ensureSchemaMigrationsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      filename    VARCHAR(255)    NOT NULL,
      applied_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_schema_migrations_filename (filename)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function getAppliedFilenames(connection) {
  const [rows] = await connection.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((row) => row.filename));
}

async function run() {
  const isDryRun = process.argv.includes('--dry-run');
  const allFiles = listMigrationFiles();

  let connection;
  try {
    connection = await mysql.createConnection(getConnectionConfig());
    await ensureSchemaMigrationsTable(connection);
    const applied = await getAppliedFilenames(connection);

    const pending = allFiles.filter((filename) => !applied.has(filename));

    if (pending.length === 0) {
      console.log('No pending migrations. Database is up to date.');
      return;
    }

    console.log(`Pending migrations (${pending.length}):`);
    pending.forEach((filename) => console.log(`  - ${filename}`));

    if (isDryRun) {
      console.log('\n--dry-run: no migrations were executed.');
      return;
    }

    for (const filename of pending) {
      const filePath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`\nApplying ${filename}...`);
      await connection.query(sql);

      // INSERT IGNORE: some migration files (e.g. the 0000 baseline) already
      // record themselves in schema_migrations as their final statement.
      await connection.query(
        'INSERT IGNORE INTO schema_migrations (filename) VALUES (?)',
        [filename]
      );

      console.log(`✅ Applied ${filename}`);
    }

    console.log('\nAll pending migrations applied successfully.');
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
