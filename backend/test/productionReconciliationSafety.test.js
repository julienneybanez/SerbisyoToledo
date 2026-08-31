import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const backendRoot = path.resolve(__dirname, '..');
const reconcilePath = path.join(backendRoot, 'scripts', 'reconcile-production-schema.js');
const auditPath = path.join(backendRoot, 'scripts', 'audit-runtime-schema.js');
const requestControllerPath = path.join(backendRoot, 'controllers', 'serviceRequestController.js');

describe('production database reconciliation safety', () => {
  it('defaults to dry-run and requires explicit production + backup confirmation before apply', () => {
    const source = fs.readFileSync(reconcilePath, 'utf8');

    expect(source).toContain("const APPLY = process.argv.includes('--apply')");
    expect(source).toContain("const CONFIRM_PRODUCTION = process.argv.includes('--confirm-production')");
    expect(source).toContain("PRODUCTION_DB_BACKUP_CONFIRMED");
    expect(source).toContain("Refusing to apply without --confirm-production.");
    expect(source).toContain("Refusing to apply until PRODUCTION_DB_BACKUP_CONFIRMED=yes");
  });

  it('does not contain destructive drop/truncate operations', () => {
    const source = fs.readFileSync(reconcilePath, 'utf8');

    expect(source).not.toMatch(/\bDROP\s+(?:TABLE|DATABASE|COLUMN)\b/i);
    expect(source).not.toMatch(/\bTRUNCATE\b/i);
    expect(source).not.toMatch(/\bDELETE\s+FROM\s+(?:users|service_profiles|service_requests)\b/i);
  });

  it('keeps the standalone runtime audit read-only', () => {
    const source = fs.readFileSync(auditPath, 'utf8');

    expect(source).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\s+/i);
    expect(source).toContain('information_schema.TABLES');
    expect(source).toContain('information_schema.COLUMNS');
  });

  it('persists the canonical date range when creating and accepting reschedules', () => {
    const source = fs.readFileSync(requestControllerPath, 'utf8');

    expect(source).toContain('booking_type,');
    expect(source).toContain('start_date,');
    expect(source).toContain('end_date,');
    expect(source).toContain('duration_days,');
    expect(source).toContain('SET booking_type = ?,');
    expect(source).toContain('start_date = ?,');
    expect(source).toContain('end_date = ?,');
    expect(source).toContain('duration_days = ?,');
  });
});
