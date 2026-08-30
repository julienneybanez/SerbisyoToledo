const fs = require('node:fs');
const path = require('node:path');

const controllerPath = path.join(__dirname, '..', 'controllers', 'adminController.js');

describe('Canonical admin reports SQL', () => {
  it('uses baseline user_reports columns only', () => {
    const source = fs.readFileSync(controllerPath, 'utf8');

    expect(source).toContain('r.screenshot_url');
    expect(source).toContain('SET status = ?');
    expect(source).toContain("nextStatus = 'investigating'");
    expect(source).not.toMatch(/r\.(priority|report_status|action_taken|moderation_notes|resolution_notes|screenshot_data|screenshot_mime)/);
    expect(source).not.toMatch(/SET\s+(report_status|action_taken|resolution_notes|moderation_notes)/);
  });
});
