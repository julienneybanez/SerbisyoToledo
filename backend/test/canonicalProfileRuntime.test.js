const fs = require('node:fs');
const path = require('node:path');

const controllerPath = path.join(__dirname, '..', 'controllers', 'serviceProfileController.js');

describe('Canonical profile runtime SQL', () => {
  it('uses service_request_dates instead of retired request date columns for active booking status', () => {
    const source = fs.readFileSync(controllerPath, 'utf8');

    expect(source).toContain('FROM service_request_dates srd_busy');
    expect(source).toContain('srd_busy.service_date = DATE(${TOLEDO_NOW_SQL})');
    expect(source).not.toContain('sr_busy.start_date');
    expect(source).not.toContain('sr_busy.end_date');
  });
});
