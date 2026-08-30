const fs = require('fs');
const path = require('path');

const baselineSql = fs.readFileSync(
  path.join(__dirname, '../migrations/0000_baseline_canonical_schema.sql'),
  'utf8'
);

describe('legal_acceptances canonical uniqueness (static schema check)', () => {
  // No local MySQL 9.4 instance is available in this environment, so this
  // test statically verifies the migration text implements the required
  // NULL-safe uniqueness strategy instead of asserting runtime DB behavior.

  it('defines a NOT NULL generated verification_request_key column', () => {
    expect(baselineSql).toMatch(
      /verification_request_key\s+INT UNSIGNED\s+GENERATED ALWAYS AS \(COALESCE\(verification_request_id, 0\)\) STORED NOT NULL/
    );
  });

  it('builds the unique constraint on the generated key, not the nullable FK column', () => {
    expect(baselineSql).toMatch(
      /UNIQUE KEY uq_legal_acceptance_event \(user_id, acceptance_type, document_version, context, verification_request_key\)/
    );
    expect(baselineSql).not.toMatch(
      /UNIQUE KEY uq_legal_acceptance_event \(user_id, acceptance_type, document_version, context, verification_request_id\)/
    );
  });

  it('keeps verification_request_id itself nullable (registration rows have none)', () => {
    expect(baselineSql).toMatch(/verification_request_id\s+INT UNSIGNED\s+NULL/);
  });
});
