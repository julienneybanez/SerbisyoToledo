const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const db = require('../config/database');
const app = require('../server');

const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

const authUserSql = 'SELECT id, user_type, is_active FROM users WHERE id = ? LIMIT 1';

const ADMIN_ID = 1;
const PROVIDER_ID = 21;

// Minimal valid PNG signature so upload signature-sniffing validation accepts the fixture.
const PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);

describe('Admin/provider integrity', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generic User Management cannot bypass the formal provider verification workflow', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: ADMIN_ID, user_type: 'admin', is_active: 1 }]];
      return [[]];
    });

    const res = await request(app)
      .put(`/api/admin/users/${PROVIDER_ID}/status`)
      .set('Authorization', `Bearer ${signToken(ADMIN_ID)}`)
      .send({ isVerified: true });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('USE_VERIFICATION_WORKFLOW');
  });

  it('deactivating a user preserves relational history (soft-deactivate, not delete)', async () => {
    let updateSql = null;
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: ADMIN_ID, user_type: 'admin', is_active: 1 }]];
      if (sql === 'SELECT id, user_type FROM users WHERE id = ? LIMIT 1') {
        return [[{ id: PROVIDER_ID, user_type: 'tradesperson' }]];
      }
      if (String(sql).includes('UPDATE users SET is_active = FALSE')) {
        updateSql = sql;
        return [{ affectedRows: 1 }];
      }
      if (String(sql).includes('UPDATE service_profiles SET is_published = FALSE')) {
        return [{ affectedRows: 1 }];
      }
      return [[]];
    });

    const res = await request(app)
      .delete(`/api/admin/users/${PROVIDER_ID}`)
      .set('Authorization', `Bearer ${signToken(ADMIN_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/preserved/i);
    expect(updateSql).not.toMatch(/DELETE/i);
  });

  it('excludes inactive/unverified providers from the public discovery query', async () => {
    let capturedSql = '';
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      capturedSql = String(sql);
      if (capturedSql.includes('FROM service_profiles sp') && capturedSql.includes('is_verified')) {
        return [[]];
      }
      return [[]];
    });

    const res = await request(app).get('/api/service-profiles/all');

    expect(res.status).toBe(200);
    expect(capturedSql).toMatch(/u\.is_verified\s*=\s*TRUE/i);
    expect(capturedSql).toMatch(/u\.is_active\s*=\s*TRUE/i);
  });

  it('requires government ID but not certification for provider verification submission', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: PROVIDER_ID, user_type: 'tradesperson', is_active: 1 }]];
      if (sql === 'SELECT id, user_type FROM users WHERE id = ?') return [[{ id: PROVIDER_ID, user_type: 'tradesperson' }]];
      return [[]];
    });

    const resWithoutGovId = await request(app)
      .post('/api/user/verification-request')
      .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`)
      .field('fullName', 'Provider One')
      .field('phoneNumber', '09171234567')
      .field('address', 'Poblacion, Toledo City')
      .field('serviceDescription', 'Plumbing services');

    expect(resWithoutGovId.status).toBe(400);

    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: PROVIDER_ID, user_type: 'tradesperson', is_active: 1 }]];
      if (sql === 'SELECT id, user_type FROM users WHERE id = ?') return [[{ id: PROVIDER_ID, user_type: 'tradesperson' }]];
      if (String(sql).includes('FROM verification_requests WHERE user_id')) return [[]];
      return [[]];
    });

    const conn = {
      beginTransaction: vi.fn(async () => {}),
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
      release: vi.fn(() => {}),
      query: vi.fn(async (sql) => {
        if (String(sql).includes('INSERT INTO verification_requests')) return [{ insertId: 1 }];
        if (String(sql).includes('INSERT INTO legal_acceptances')) return [{ insertId: 1 }];
        return [[]];
      }),
    };
    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const resWithGovIdOnly = await request(app)
      .post('/api/user/verification-request')
      .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`)
      .field('fullName', 'Provider One')
      .field('phoneNumber', '09171234567')
      .field('address', 'Poblacion, Toledo City')
      .field('serviceDescription', 'Plumbing services')
      .field('verificationConsent', 'true')
      .attach('governmentId', PNG_BUFFER, { filename: 'id.png', contentType: 'image/png' });

    expect(resWithGovIdOnly.status).toBe(201);
  });

  it('returns verification document metadata in the admin list without document bodies', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: ADMIN_ID, user_type: 'admin', is_active: 1 }]];
      if (String(sql).includes('FROM verification_requests vr')) {
        return [[{
          id: 3,
          user_id: PROVIDER_ID,
          full_name: 'Provider One',
          phone_number: '09171234567',
          address: 'Poblacion',
          service_description: 'Plumbing',
          has_government_id: 1,
          has_certifications: 0,
          status: 'pending',
          created_at: new Date(),
          email: 'provider@example.test',
          profession: 'Plumber',
        }]];
      }
      return [[]];
    });

    const res = await request(app)
      .get('/api/admin/verification-requests')
      .set('Authorization', `Bearer ${signToken(ADMIN_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].documents).toEqual({ hasGovernmentId: true, hasCertifications: false });
    expect(JSON.stringify(res.body)).not.toContain('data:');
  });

  it('allows only admins to explicitly fetch one verification document', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: ADMIN_ID, user_type: 'admin', is_active: 1 }]];
      if (String(sql).includes('AS document_data')) {
        return [[{ document_data: PNG_BUFFER, document_mime: 'image/png' }]];
      }
      return [[]];
    });

    const adminResponse = await request(app)
      .get('/api/admin/verification-requests/3/documents/government-id')
      .set('Authorization', `Bearer ${signToken(ADMIN_ID)}`);
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.data.dataUrl).toMatch(/^data:image\/png;base64,/);

    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: PROVIDER_ID, user_type: 'tradesperson', is_active: 1 }]];
      return [[]];
    });
    const providerResponse = await request(app)
      .get('/api/admin/verification-requests/3/documents/government-id')
      .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`);
    expect(providerResponse.status).toBe(403);

    const unauthenticatedResponse = await request(app)
      .get('/api/admin/verification-requests/3/documents/government-id');
    expect(unauthenticatedResponse.status).toBe(401);
  });

  it('credential approval uses the credential-specific notification type', async () => {
    let insertedNotification = null;
    vi.spyOn(db, 'query').mockImplementation(async (sql, params) => {
      if (sql === authUserSql) return [[{ id: ADMIN_ID, user_type: 'admin', is_active: 1 }]];
      if (String(sql).includes('FROM provider_credentials pc') && String(sql).includes('JOIN service_profiles sp')) {
        return [[{ id: 5, verification_status: 'pending', provider_user_id: PROVIDER_ID, credential_name: 'NCII Plumbing' }]];
      }
      if (String(sql).includes('UPDATE provider_credentials')) return [{ affectedRows: 1 }];
      if (String(sql).includes('INSERT INTO notifications')) {
        insertedNotification = params;
        return [{ insertId: 1 }];
      }
      return [[]];
    });

    const res = await request(app)
      .patch('/api/admin/provider-credentials/5')
      .set('Authorization', `Bearer ${signToken(ADMIN_ID)}`)
      .send({ action: 'approve' });

    expect(res.status).toBe(200);
    expect(insertedNotification[1]).toBe('credential_approved');
  });

  it('credential rejection uses the credential-specific notification type and requires a reason', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: ADMIN_ID, user_type: 'admin', is_active: 1 }]];
      if (String(sql).includes('FROM provider_credentials pc') && String(sql).includes('JOIN service_profiles sp')) {
        return [[{ id: 5, verification_status: 'pending', provider_user_id: PROVIDER_ID, credential_name: 'NCII Plumbing' }]];
      }
      return [[]];
    });

    const missingReason = await request(app)
      .patch('/api/admin/provider-credentials/5')
      .set('Authorization', `Bearer ${signToken(ADMIN_ID)}`)
      .send({ action: 'reject' });
    expect(missingReason.status).toBe(400);

    let insertedNotification = null;
    vi.spyOn(db, 'query').mockImplementation(async (sql, params) => {
      if (sql === authUserSql) return [[{ id: ADMIN_ID, user_type: 'admin', is_active: 1 }]];
      if (String(sql).includes('FROM provider_credentials pc') && String(sql).includes('JOIN service_profiles sp')) {
        return [[{ id: 5, verification_status: 'pending', provider_user_id: PROVIDER_ID, credential_name: 'NCII Plumbing' }]];
      }
      if (String(sql).includes('UPDATE provider_credentials')) return [{ affectedRows: 1 }];
      if (String(sql).includes('INSERT INTO notifications')) {
        insertedNotification = params;
        return [{ insertId: 1 }];
      }
      return [[]];
    });

    const res = await request(app)
      .patch('/api/admin/provider-credentials/5')
      .set('Authorization', `Bearer ${signToken(ADMIN_ID)}`)
      .send({ action: 'reject', reason: 'Document expired.' });

    expect(res.status).toBe(200);
    expect(insertedNotification[1]).toBe('credential_rejected');
  });

  it('rejects standalone manual portfolio uploads (public portfolio must link to a completed platform request)', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: PROVIDER_ID, user_type: 'tradesperson', is_active: 1 }]];
      return [[]];
    });

    const res = await request(app)
      .post('/api/service-profiles/portfolio/image')
      .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`)
      .attach('portfolioImage', PNG_BUFFER, { filename: 'job.png', contentType: 'image/png' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PORTFOLIO_PLATFORM_JOBS_ONLY');
  });
});
