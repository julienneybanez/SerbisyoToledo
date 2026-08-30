const db = require('../config/database');
const cloudinaryService = require('../utils/cloudinaryService');
const serviceRequestController = require('../controllers/serviceRequestController');
const serviceProfileController = require('../controllers/serviceProfileController');

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const reportRequest = (overrides = {}) => ({
  params: { requestId: 10 },
  user: { userId: 1 },
  body: { reportedUserId: 2, reason: 'Test reason', description: 'Test description' },
  ...overrides,
});

describe('canonical report screenshot workflow', () => {
  beforeEach(() => vi.restoreAllMocks());

  const mockReportParticipant = (insertResult = { insertId: 1 }) => vi.spyOn(db, 'query').mockImplementation(async (sql) => {
    if (String(sql).includes('FROM service_requests')) return [[{ id: 10, client_id: 1, provider_id: 2 }]];
    if (String(sql).includes('INSERT INTO user_reports')) return [insertResult];
    return [[]];
  });

  it('stores a no-screenshot report with canonical columns only', async () => {
    let insertSql = '';
    mockReportParticipant();
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (String(sql).includes('FROM service_requests')) return [[{ id: 10, client_id: 1, provider_id: 2 }]];
      if (String(sql).includes('INSERT INTO user_reports')) { insertSql = String(sql); return [{ insertId: 1 }]; }
      return [[]];
    });
    const res = response();
    await serviceRequestController.createReport(reportRequest(), res);
    expect(res.statusCode).toBe(201);
    expect(insertSql).toMatch(/screenshot_url/);
    expect(insertSql).not.toMatch(/screenshot_data|screenshot_mime|priority/);
  });

  it('uploads a valid screenshot and stores only its URL', async () => {
    let insertParams;
    vi.spyOn(cloudinaryService, 'hasCloudinaryConfig').mockReturnValue(true);
    const upload = vi.spyOn(cloudinaryService, 'uploadImageBuffer').mockResolvedValue({ secure_url: 'https://images.test/evidence.png', public_id: 'evidence' });
    vi.spyOn(db, 'query').mockImplementation(async (sql, params) => {
      if (String(sql).includes('FROM service_requests')) return [[{ id: 10, client_id: 1, provider_id: 2 }]];
      if (String(sql).includes('INSERT INTO user_reports')) { insertParams = params; return [{ insertId: 1 }]; }
      return [[]];
    });
    const res = response();
    await serviceRequestController.createReport(reportRequest({ file: { buffer: Buffer.from('png'), mimetype: 'image/png' } }), res);
    expect(res.statusCode).toBe(201);
    expect(upload).toHaveBeenCalledOnce();
    expect(insertParams).toContain('https://images.test/evidence.png');
  });

  it('cleans up a newly uploaded screenshot when canonical report insertion fails', async () => {
    vi.spyOn(cloudinaryService, 'hasCloudinaryConfig').mockReturnValue(true);
    vi.spyOn(cloudinaryService, 'uploadImageBuffer').mockResolvedValue({ secure_url: 'https://images.test/evidence.png', public_id: 'new-evidence' });
    const cleanup = vi.spyOn(cloudinaryService, 'deleteImageByPublicId').mockResolvedValue();
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (String(sql).includes('FROM service_requests')) return [[{ id: 10, client_id: 1, provider_id: 2 }]];
      if (String(sql).includes('INSERT INTO user_reports')) throw new Error('insert failed');
      return [[]];
    });
    const res = response();
    await serviceRequestController.createReport(reportRequest({ file: { buffer: Buffer.from('png'), mimetype: 'image/png' } }), res);
    expect(res.statusCode).toBe(500);
    expect(cleanup).toHaveBeenCalledWith('new-evidence');
  });

  it('rejects unrelated reporters and non-counterparty reported users before persistence', async () => {
    const insert = vi.fn();
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (String(sql).includes('FROM service_requests')) return [[]];
      if (String(sql).includes('INSERT INTO user_reports')) return insert();
      return [[]];
    });
    const unrelated = response();
    await serviceRequestController.createReport(reportRequest(), unrelated);
    expect(unrelated.statusCode).toBe(404);

    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (String(sql).includes('FROM service_requests')) return [[{ id: 10, client_id: 1, provider_id: 2 }]];
      return [[]];
    });
    const wrongCounterparty = response();
    await serviceRequestController.createReport(reportRequest({ body: { reportedUserId: 3, reason: 'Test', description: 'Test' } }), wrongCounterparty);
    expect(wrongCounterparty.statusCode).toBe(403);
  });
});

describe('credential and review application validation', () => {
  beforeEach(() => vi.restoreAllMocks());

  it.each([true, 'true', 1, '1'])('stores doesNotExpire=%p as true and clears expiration', async (doesNotExpire) => {
    let params;
    vi.spyOn(db, 'query').mockImplementation(async (sql, values) => {
      if (String(sql).startsWith('SELECT id FROM service_profiles')) return [[{ id: 7 }]];
      if (String(sql).includes('INSERT INTO provider_credentials')) { params = values; return [{ insertId: 1 }]; }
      return [[]];
    });
    const res = response();
    await serviceProfileController.createCredential({ user: { userId: 2 }, body: { credentialName: 'License', credentialType: 'professional_license', issueDate: '2025-01-01', expirationDate: '2026-01-01', doesNotExpire } }, res);
    expect(res.statusCode).toBe(201);
    expect(params[6]).toBeNull();
    expect(params[7]).toBe(true);
  });

  it.each([false, 'false', 0, '0', '', null, undefined])('stores doesNotExpire=%p as false', async (doesNotExpire) => {
    let params;
    vi.spyOn(db, 'query').mockImplementation(async (sql, values) => {
      if (String(sql).startsWith('SELECT id FROM service_profiles')) return [[{ id: 7 }]];
      if (String(sql).includes('INSERT INTO provider_credentials')) { params = values; return [{ insertId: 1 }]; }
      return [[]];
    });
    const res = response();
    await serviceProfileController.createCredential({ user: { userId: 2 }, body: { credentialName: 'License', credentialType: 'professional_license', expirationDate: '2026-01-01', doesNotExpire } }, res);
    expect(res.statusCode).toBe(201);
    expect(params[7]).toBe(false);
  });

  it.each(['TESDA Certificate', 'administrator', 'DROP TABLE users', ''])('rejects invalid credential type %s before database insertion', async (credentialType) => {
    const query = vi.spyOn(db, 'query').mockResolvedValue([[{ id: 7 }]]);
    const res = response();
    await serviceProfileController.createCredential({ user: { userId: 2 }, body: { credentialName: 'License', credentialType } }, res);
    expect(res.statusCode).toBe(400);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it.each([
    'professional_license', 'tesda_certification', 'safety_training', 'technical_certification',
    'government_accreditation', 'manufacturer_certification', 'training_certificate', 'other',
  ])('accepts canonical credential type %s', async (credentialType) => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (String(sql).startsWith('SELECT id FROM service_profiles')) return [[{ id: 7 }]];
      if (String(sql).includes('INSERT INTO provider_credentials')) return [{ insertId: 1 }];
      return [[]];
    });
    const res = response();
    await serviceProfileController.createCredential({ user: { userId: 2 }, body: { credentialName: 'Credential', credentialType } }, res);
    expect(res.statusCode).toBe(201);
  });

  it.each([0, 0.5, 2.2, 5.5, 'bad'])('rejects invalid review rating %p before request lookup', async (rating) => {
    const query = vi.spyOn(db, 'query');
    const res = response();
    await serviceRequestController.createReview({ params: { requestId: 1 }, user: { userId: 1 }, body: { rating } }, res);
    expect(res.statusCode).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it.each([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5])('accepts valid review rating %p for a completed request', async (rating) => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (String(sql).includes('FROM service_requests sr')) {
        return [[{ id: 1, provider_id: 2, status: 'completed', service_type_label: 'Leak Repair', client_name: 'Client' }]];
      }
      if (String(sql).includes('SELECT id FROM reviews')) return [[]];
      if (String(sql).includes('INSERT INTO reviews')) return [{ insertId: 1 }];
      return [[]];
    });
    const res = response();
    await serviceRequestController.createReview({ params: { requestId: 1 }, user: { userId: 1 }, body: { rating } }, res);
    expect(res.statusCode).toBe(201);
  });
});