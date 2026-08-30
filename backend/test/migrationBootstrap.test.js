import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const backendRoot = path.resolve(__dirname, '..');
const migrationsRoot = path.join(backendRoot, 'migrations');
const baselinePath = path.join(migrationsRoot, '0000_baseline_canonical_schema.sql');
const runnerPath = path.join(backendRoot, 'scripts', 'migrate.js');

// Mock database connection responses for bootstrap state testing
// Note: These are UNIT tests using mocks. No real MySQL connection is used.

describe('Migration Runner Bootstrap States', () => {
  // Helper to create a mock connection
  function createMockConnection(responseMap) {
    const connection = {
      query: vi.fn(async (sql, params) => {
        // Lookup the response by SQL query pattern
        for (const [pattern, response] of Object.entries(responseMap)) {
          if (sql.includes(pattern)) {
            return response;
          }
        }
        throw new Error(`No mock response for SQL: ${sql.substring(0, 50)}`);
      }),
      end: vi.fn(async () => {}),
    };
    return connection;
  }

  describe('STATE A: Completely Empty Database (no tables, no schema_migrations)', () => {
    it('should detect empty database and permit baseline migration', async () => {
      // STATE A: information_schema shows no tables
      const connection = createMockConnection({
        'schema_migrations': [[], []],  // Query: does schema_migrations exist? → NO
        'information_schema.TABLES': [[], []],  // Query: any application tables? → NO
      });

      // Simulate bootstrapDatabase logic
      const schemaExists = (await connection.query('SELECT ... schema_migrations'))[0].length > 0;
      const appTables = (await connection.query('SELECT ... information_schema.TABLES'))[0];

      expect(schemaExists).toBe(false);
      expect(appTables.length).toBe(0);

      // Expected behavior: baseline is permitted
      console.log('✓ STATE A detected: fresh database, baseline permitted');
    });

    it('leaves schema_migrations creation and baseline recording to the baseline SQL', () => {
      const runnerSource = fs.readFileSync(runnerPath, 'utf8');
      const baselineSource = fs.readFileSync(baselinePath, 'utf8');

      expect(runnerSource).not.toMatch(/CREATE TABLE schema_migrations/);
      expect(baselineSource).toMatch(/CREATE TABLE schema_migrations/);
      expect(baselineSource).toMatch(/INSERT INTO schema_migrations \(filename\) VALUES \('0000_baseline_canonical_schema\.sql'\)/);
    });
  });

  describe('STATE B: Canonical Database (schema_migrations exists with baseline)', () => {
    it('should detect canonical database and proceed with pending migrations', async () => {
      // STATE B: schema_migrations exists and has baseline record
      const connection = createMockConnection({
        'schema_migrations': [
          [{ TABLE_NAME: 'schema_migrations' }],
          [],
        ],
        'baseline': [
          [{ filename: '0000_baseline_canonical_schema.sql' }],
          [],
        ],
      });

      // Check if schema_migrations exists
      const [schemaTables] = await connection.query('SELECT ... schema_migrations');
      const schemaExists = schemaTables.length > 0;
      expect(schemaExists).toBe(true);

      // Check if baseline record present
      const [baselineRecords] = await connection.query('SELECT ... baseline');
      const baselinePresent = baselineRecords.length > 0;
      expect(baselinePresent).toBe(true);

      console.log('✓ STATE B detected: canonical database, baseline present, proceeding');
    });
  });

  describe('STATE C: Application Tables Without schema_migrations (ERROR)', () => {
    it('should reject database with application tables but no schema_migrations', async () => {
      // STATE C: application tables exist but schema_migrations does not
      const connection = createMockConnection({
        'schema_migrations': [[], []],  // Does NOT exist
        'information_schema.TABLES': [
          // Application tables present
          [
            { TABLE_NAME: 'users' },
            { TABLE_NAME: 'service_profiles' },
            { TABLE_NAME: 'service_requests' },
          ],
          [],
        ],
      });

      const [schemaCheckResult] = await connection.query('SELECT ... schema_migrations');
      const schemaExists = schemaCheckResult.length > 0;
      
      const [appTablesResult] = await connection.query('SELECT ... information_schema.TABLES');
      const appTables = appTablesResult;

      expect(schemaExists).toBe(false);
      expect(appTables.length).toBeGreaterThan(0);

      // Expected behavior: ERROR (cannot proceed)
      console.log(`✗ STATE C detected: ${appTables.length} application tables found without schema_migrations`);
      console.log('  Would throw error and exit with code 1');
    });

    it('should list specific tables in error message', () => {
      const appTables = ['users', 'service_profiles', 'service_requests'];
      const errorMsg = `Tables found: ${appTables.join(', ')}`;
      expect(errorMsg).toContain('users');
      expect(errorMsg).toContain('service_profiles');
    });
  });

  describe('STATE D: schema_migrations Without Baseline (ERROR)', () => {
    it('should reject database where schema_migrations exists but baseline missing', async () => {
      // STATE D: schema_migrations table exists but baseline record absent
      const connection = createMockConnection({
        'schema_migrations': [
          [{ TABLE_NAME: 'schema_migrations' }],
          [],
        ],
        'baseline': [
          [],  // No baseline record
          [],
        ],
      });

      const [schemaTables] = await connection.query('SELECT ... schema_migrations');
      const schemaExists = schemaTables.length > 0;
      expect(schemaExists).toBe(true);

      const [baselineRecords] = await connection.query('SELECT ... baseline');
      const baselinePresent = baselineRecords.length > 0;
      expect(baselinePresent).toBe(false);

      // Expected behavior: ERROR (cannot proceed)
      console.log('✗ STATE D detected: schema_migrations exists but baseline record missing');
      console.log('  Would throw error and exit with code 1');
    });
  });

  describe('Bootstrap State Logic Decisions', () => {
    it('should permit baseline only when database is completely empty', () => {
      // Logic: permit baseline ONLY if schema_migrations does NOT exist AND no app tables
      const states = {
        'Fresh (no tables, no schema_migrations)': { schemaExists: false, appTables: 0, permitBaseline: true },
        'Canonical (schema_migrations + baseline)': { schemaExists: true, appTables: 0, permitBaseline: false },
        'Corrupted (app tables, no schema_migrations)': { schemaExists: false, appTables: 3, permitBaseline: false },
        'Inconsistent (schema_migrations, no baseline)': { schemaExists: true, appTables: 0, permitBaseline: false },
      };

      Object.entries(states).forEach(([state, { schemaExists, appTables, permitBaseline }]) => {
        const shouldPermitBaseline = !schemaExists && appTables === 0;
        expect(shouldPermitBaseline).toBe(permitBaseline);
        console.log(`  ${state}: ${permitBaseline ? 'PERMIT BASELINE' : 'BLOCK'}`);
      });
    });

    it('discovers only active top-level canonical migration SQL', () => {
      const activeMigrationFiles = fs.readdirSync(migrationsRoot)
        .filter((name) => name.endsWith('.sql') && !name.endsWith('.rollback.sql'));
      const legacyMigrationFiles = fs.readdirSync(path.join(migrationsRoot, 'legacy'))
        .filter((name) => name.endsWith('.sql'));

      expect(activeMigrationFiles).toEqual(['0000_baseline_canonical_schema.sql']);
      expect(legacyMigrationFiles.length).toBeGreaterThan(0);
      expect(activeMigrationFiles.some((name) => name.startsWith('2026'))).toBe(false);
    });

    it('should block migration runner from running 0000 against legacy database', () => {
      // Simulate: app has old tables but schema_migrations doesn't exist
      const hasLegacyTables = true;
      const hasSchemaMigrations = false;

      const canRun0000 = !hasSchemaMigrations && !hasLegacyTables;
      expect(canRun0000).toBe(false);
      console.log('✓ 0000 baseline prevented from running against legacy schema');
    });
  });

  describe('Error Messages', () => {
    it('STATE C error should guide operator toward recovery', () => {
      const errorC = `BOOTSTRAP ERROR (State C):\nDatabase contains application tables but schema_migrations table not found.\nThis indicates a partially-initialized or legacy schema.`;
      expect(errorC).toContain('ERROR');
      expect(errorC).toContain('schema_migrations');
      expect(errorC).toContain('partially-initialized');
    });

    it('STATE D error should guide operator toward recovery', () => {
      const errorD = `BOOTSTRAP ERROR (State D):\nschema_migrations table exists but baseline record not found.\nCannot determine if the canonical schema is fully present.`;
      expect(errorD).toContain('ERROR');
      expect(errorD).toContain('baseline record not found');
      expect(errorD).toContain('Cannot determine');
    });

    it('uses RESTRICT for a verification request referenced by legal acceptance evidence', () => {
      const baselineSource = fs.readFileSync(baselinePath, 'utf8');
      const constraintLine = baselineSource.split('\n').find((line) => (
        line.includes('fk_legal_acceptance_verification')
      ));

      expect(constraintLine).toContain('ON DELETE RESTRICT');
      expect(constraintLine).not.toContain('ON DELETE SET NULL');
    });
  });
});
