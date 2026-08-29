const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const db = require('../config/database');
const app = require('../server');

const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

const authUserSql = 'SELECT id, user_type, is_active FROM users WHERE id = ? LIMIT 1';

const createConnectionMock = (queryImpl) => ({
  beginTransaction: vi.fn(async () => {}),
  commit: vi.fn(async () => {}),
  rollback: vi.fn(async () => {}),
  release: vi.fn(() => {}),
  query: vi.fn(queryImpl),
});

describe('Backend Security Hardening', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1) denies unauthenticated access to protected routes', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('2) prevents client from creating provider profile', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 1, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const res = await request(app)
      .post('/api/service-profiles/create')
      .set('Authorization', `Bearer ${signToken(1)}`)
      .field('fullName', 'Client User')
      .field('barangayAddress', 'Poblacion')
      .field('startingPrice', '500')
      .field('serviceCategories', JSON.stringify(['Plumbing']));

    expect(res.status).toBe(403);
  });

  it('2b) prevents an unverified provider from posting a service listing', async () => {
    const mockConnection = createConnectionMock(async (sql) => {
      return [[]];
    });

    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) {
        return [[{ id: 2, user_type: 'tradesperson', is_active: 1 }]];
      }
      if (String(sql).includes('SELECT user_type, is_verified, is_active FROM users WHERE id = ? LIMIT 1')) {
        return [[{ user_type: 'tradesperson', is_verified: 0, is_active: 1 }]];
      }
      if (String(sql).includes('SELECT id, banner_image_public_id FROM service_profiles WHERE user_id = ?')) {
        return [[]];
      }
      return [[]];
    });

    vi.spyOn(db, 'getConnection').mockResolvedValue(mockConnection);

    const res = await request(app)
      .post('/api/service-profiles/create')
      .set('Authorization', `Bearer ${signToken(2)}`)
      .field('barangayAddress', 'Poblacion')
      .field('startingPrice', '500')
      .field('serviceCategories', JSON.stringify(['Plumbing']))
      .field('serviceTypes', JSON.stringify([]));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PROVIDER_VERIFICATION_REQUIRED');
  });

  it('3) prevents provider from deleting another provider portfolio image', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 2, user_type: 'tradesperson', is_active: 1 }]];
      if (sql.includes('SELECT pi.id, pi.image_public_id FROM portfolio_items')) return [[]];
      return [[]];
    });

    const res = await request(app)
      .delete('/api/service-profiles/portfolio/image/99')
      .set('Authorization', `Bearer ${signToken(2)}`);

    expect(res.status).toBe(404);
  });

  it('4) allows client to create a valid service request', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 10, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (sql.includes('SELECT') && sql.includes('FROM service_profiles sp')) {
        return [[{ 
          service_profile_id: 7, 
          provider_id: 21, 
          is_published: 1, 
          user_type: 'tradesperson', 
          is_active: 1,
          service_types: JSON.stringify(['leak_repair']),
          service_categories: JSON.stringify(['Plumbing'])
        }]];
      }
      if (sql.includes('SELECT sr.id, sr.provider_id, sr.service_type_key')) {
        return [[]];  // No active conflicts
      }
      if (sql.includes('SELECT category_key FROM service_profile_categories')) {
        return [[{ category_key: 'plumbing' }]];
      }
      if (sql.includes('SELECT service_type_key FROM service_profile_types')) {
        return [[{ service_type_key: 'leak_repair' }]];
      }
      if (sql.includes('SELECT availability_status FROM provider_availability_settings')) {
        return [[{ availability_status: 'available' }]];
      }
      if (sql.includes('SELECT id FROM service_requests WHERE client_id')) {
        return [[]];  // No duplicate requests
      }
      if (sql.includes('SELECT COUNT(*) as conflict_count')) {
        return [[{ conflict_count: 0 }]];  // No schedule conflicts
      }
      if (sql.includes('INSERT INTO service_requests')) {
        return [{ insertId: 501 }];
      }
      if (sql.includes('INSERT INTO service_request_status_history')) {
        return [{ insertId: 1 }];
      }
      if (sql.includes('SELECT full_name FROM users')) {
        return [[{ full_name: 'Client One' }]];
      }
      if (sql.includes('INSERT INTO notifications')) {
        return [{ insertId: 900 }];
      }
      return [[]];
    });

    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .post('/api/service-requests/create')
      .set('Authorization', `Bearer ${signToken(10)}`)
      .send({
        providerId: 21,
        serviceProfileId: 7,
        jobTitle: 'Fix leaking pipe',
        jobDetails: 'Kitchen sink pipe is leaking heavily.',
        serviceLocation: '123 Rizal St, Toledo City',
        bookingType: 'one_day',
        startDate: '2099-12-31',
        endDate: '2099-12-31',
        startTime: '09:00',
        estimatedDurationMinutes: 120,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('5) prevents provider from creating client booking', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 21, user_type: 'tradesperson', is_active: 1 }]];
      return [[]];
    });

    const res = await request(app)
      .post('/api/service-requests/create')
      .set('Authorization', `Bearer ${signToken(21)}`)
      .send({
        providerId: 30,
        serviceProfileId: 7,
        jobTitle: 'Test',
        jobDetails: 'Test details',
        bookingType: 'one_day',
        startDate: '2099-12-31',
        endDate: '2099-12-31',
        startTime: '09:00',
        estimatedDurationMinutes: 120,
      });

    expect(res.status).toBe(403);
  });

  it('6) rejects provider/profile mismatch during booking creation', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 10, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (sql.includes('FROM service_profiles sp')) {
        return [[{ service_profile_id: 7, provider_id: 21, is_published: 1, user_type: 'tradesperson', is_active: 1 }]];
      }
      return [[]];
    });

    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .post('/api/service-requests/create')
      .set('Authorization', `Bearer ${signToken(10)}`)
      .send({
        providerId: 999,
        serviceProfileId: 7,
        jobTitle: 'Fix leaking pipe',
        jobDetails: 'Kitchen sink pipe is leaking heavily.',
        serviceLocation: '123 Rizal St, Toledo City',
        bookingType: 'one_day',
        startDate: '2099-12-31',
        endDate: '2099-12-31',
        startTime: '09:00',
        estimatedDurationMinutes: 120,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/mismatch/i);
  });

  it('7) rejects booking unpublished service profile', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 10, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (sql.includes('FROM service_profiles sp')) {
        return [[{ service_profile_id: 7, provider_id: 21, is_published: 0, user_type: 'tradesperson', is_active: 1 }]];
      }
      return [[]];
    });

    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .post('/api/service-requests/create')
      .set('Authorization', `Bearer ${signToken(10)}`)
      .send({
        providerId: 21,
        serviceProfileId: 7,
        jobTitle: 'Fix leaking pipe',
        jobDetails: 'Kitchen sink pipe is leaking heavily.',
        bookingType: 'one_day',
        startDate: '2099-12-31',
        endDate: '2099-12-31',
        startTime: '09:00',
        estimatedDurationMinutes: 120,
      });

    expect(res.status).toBe(400);
  });

  it('8) prevents client from booking own profile', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 10, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (sql.includes('FROM service_profiles sp')) {
        return [[{ service_profile_id: 7, provider_id: 10, is_published: 1, user_type: 'tradesperson', is_active: 1 }]];
      }
      return [[]];
    });

    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .post('/api/service-requests/create')
      .set('Authorization', `Bearer ${signToken(10)}`)
      .send({
        providerId: 10,
        serviceProfileId: 7,
        jobTitle: 'Fix leaking pipe',
        jobDetails: 'Kitchen sink pipe is leaking heavily.',
        bookingType: 'one_day',
        startDate: '2099-12-31',
        endDate: '2099-12-31',
        startTime: '09:00',
        estimatedDurationMinutes: 120,
      });

    expect(res.status).toBe(400);
  });

  it('9) blocks unrelated users from viewing request details', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 44, user_type: 'client', is_active: 1 }]];
      if (sql.includes('WHERE sr.id = ? AND (sr.client_id = ? OR sr.provider_id = ?)')) return [[]];
      return [[]];
    });

    const res = await request(app)
      .get('/api/service-requests/55')
      .set('Authorization', `Bearer ${signToken(44)}`);

    expect(res.status).toBe(404);
  });

  it('10) blocks provider from updating another provider request', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 77, user_type: 'tradesperson', is_active: 1 }]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (sql.includes('FROM service_requests sr') && sql.includes('FOR UPDATE')) return [[]];
      return [[]];
    });
    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .patch('/api/service-requests/99/status')
      .set('Authorization', `Bearer ${signToken(77)}`)
      .send({ status: 'accepted' });

    expect(res.status).toBe(404);
  });

  it('11) blocks client from provider-only status transition', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 10, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (sql.includes('FROM service_requests sr') && sql.includes('FOR UPDATE')) {
        return [[{
          id: 22,
          status: 'pending',
          client_id: 10,
          provider_id: 21,
          provider_completed: 0,
          client_completed: 0,
          provider_name: 'Provider',
          client_name: 'Client',
          job_title: 'Job',
        }]];
      }
      return [[]];
    });
    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .patch('/api/service-requests/22/status')
      .set('Authorization', `Bearer ${signToken(10)}`)
      .send({ status: 'accepted' });

    expect(res.status).toBe(403);
  });

  it('12) rejects invalid status transition', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 21, user_type: 'tradesperson', is_active: 1 }]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (sql.includes('FROM service_requests sr') && sql.includes('FOR UPDATE')) {
        return [[{
          id: 22,
          status: 'pending',
          client_id: 10,
          provider_id: 21,
          provider_completed: 0,
          client_completed: 0,
          provider_name: 'Provider',
          client_name: 'Client',
          job_title: 'Job',
        }]];
      }
      return [[]];
    });
    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .patch('/api/service-requests/22/status')
      .set('Authorization', `Bearer ${signToken(21)}`)
      .send({ status: 'on_the_way' });

    expect(res.status).toBe(409);
  });

  it('13) enforces terminal request states', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 21, user_type: 'tradesperson', is_active: 1 }]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (sql.includes('FROM service_requests sr') && sql.includes('FOR UPDATE')) {
        return [[{
          id: 22,
          status: 'declined',
          client_id: 10,
          provider_id: 21,
          provider_completed: 0,
          client_completed: 0,
          provider_name: 'Provider',
          client_name: 'Client',
          job_title: 'Job',
        }]];
      }
      return [[]];
    });
    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .patch('/api/service-requests/22/status')
      .set('Authorization', `Bearer ${signToken(21)}`)
      .send({ status: 'accepted' });

    expect(res.status).toBe(409);
  });

  it('14) blocks non-admin users from admin endpoints', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 10, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${signToken(10)}`);

    expect(res.status).toBe(403);
  });

  it('15) blocks disabled user even with a valid token', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 91, user_type: 'client', is_active: 0 }]];
      return [[]];
    });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${signToken(91)}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/disabled/i);
  });

  it('16) enforces login rate limiting with 429 responses', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql.includes('SELECT * FROM users WHERE email = ?')) return [[]];
      return [[]];
    });

    let status = 0;
    for (let i = 0; i < 25; i += 1) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'noone@example.com', password: 'wrongpass' });
      status = res.status;
      if (status === 429) break;
    }

    expect(status).toBe(429);
  });

  it('17) rejects invalid upload file signatures', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 21, user_type: 'tradesperson', is_active: 1 }]];
      return [[]];
    });

    const res = await request(app)
      .patch('/api/user/profile')
      .set('Authorization', `Bearer ${signToken(21)}`)
      .attach('profilePhoto', Buffer.from('MZ-not-an-image'), {
        filename: 'payload.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(400);
  });

  it('18) keeps public profile response free of verification docs/admin fields', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql.includes('FROM service_profiles sp') && sql.includes('WHERE sp.id = ? AND sp.is_published = TRUE')) {
        return [[{
          id: 77,
          user_id: 21,
          full_name: 'Provider Name',
          barangay_address: 'Poblacion',
          starting_price: '500.00',
          service_categories: JSON.stringify(['Plumbing']),
          description: 'Provider description',
          banner_image: null,
          banner_image_url: null,
          about_me: 'About me',
          response_time: 'Within 24 hours',
          jobs_completed: 3,
          rating: '4.9',
          reviews_count: 12,
          online: 1,
          is_verified: 1,
          profession: 'Plumber',
          skills: JSON.stringify(['Pipe repair']),
          email: 'provider@example.com',
          phone: '09123456789',
          created_at: new Date(),
        }]];
      }
      if (sql.includes('FROM portfolio_items')) return [[]];
      if (sql.includes('FROM reviews r')) return [[]];
      return [[]];
    });

    const res = await request(app).get('/api/service-profiles/77');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.documents).toBeUndefined();
    expect(res.body.data.adminNotes).toBeUndefined();
    expect(res.body.data.verificationToken).toBeUndefined();
  });

  it('19) does not expose job_details when linking completed request without description', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 21, user_type: 'tradesperson', is_active: 1 }]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (sql.includes('SELECT id FROM service_profiles WHERE user_id = ? LIMIT 1')) {
        return [[{ id: 77 }]];
      }

      if (sql.includes('FROM service_requests') && sql.includes('FOR UPDATE')) {
        return [[{
          id: 300,
          job_title: 'Completed Plumbing Work',
          job_details: 'Private issue details that should not be auto-published',
          status: 'completed',
          start_date: '2099-12-31',
          end_date: '2099-12-31',
        }]];
      }

      if (sql.includes('SELECT id FROM portfolio_items WHERE service_request_id = ? LIMIT 1')) {
        return [[]];
      }

      if (sql.includes('SELECT COALESCE(MAX(display_order), 0) + 1 AS nextOrder FROM portfolio_items WHERE service_profile_id = ?')) {
        return [[{ nextOrder: 4 }]];
      }

      if (sql.includes('INSERT INTO portfolio_items')) {
        return [{ insertId: 909 }];
      }

      return [[]];
    });

    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .post('/api/service-profiles/portfolio/from-request')
      .set('Authorization', `Bearer ${signToken(21)}`)
      .send({
        serviceRequestId: 300,
        caption: 'Completed project',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const insertCall = conn.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO portfolio_items'));
    expect(insertCall).toBeTruthy();

    const insertParams = insertCall[1];
    expect(insertParams[5]).toBe('');
  });

  it('20) rejects provider registration with unsupported language code', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Provider One',
        email: 'provider.invalidlang@example.com',
        password: 'pass123456',
        userType: 'tradesperson',
        languages: ['ceb', 'xx'],
        acceptedTerms: true,
        acknowledgedPrivacy: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/unsupported language/i);
  });

  it('21) stores provider registration languages on valid signup', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql.includes('SELECT id FROM users WHERE email = ?')) {
        return [[]];
      }
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (sql.includes('INSERT INTO users')) {
        return [{ insertId: 333 }];
      }
      if (sql.includes('INSERT INTO person_languages')) {
        return [{ insertId: 1 }];
      }
      return [[]];
    });
    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Provider Two',
        email: 'provider.validlang@example.com',
        password: 'pass123456',
        userType: 'tradesperson',
        languages: ['ceb', 'en'],
        acceptedTerms: true,
        acknowledgedPrivacy: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const languageInserts = conn.query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO person_languages'));
    expect(languageInserts.map((call) => call[1][1]).sort()).toEqual(['ceb', 'en']);
  });

  it('22) rejects profile service type when it does not match selected category', async () => {
    const mockConnection = createConnectionMock(async (sql) => {
      return [[]];
    });

    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 42, user_type: 'tradesperson', is_active: 1 }]];
      if (String(sql).includes('SELECT user_type, is_verified, is_active FROM users WHERE id = ? LIMIT 1')) {
        return [[{ user_type: 'tradesperson', is_verified: 1, is_active: 1 }]];
      }
      if (String(sql).includes('SELECT id, banner_image_public_id FROM service_profiles WHERE user_id = ?')) {
        return [[]];
      }
      return [[]];
    });

    vi.spyOn(db, 'getConnection').mockResolvedValue(mockConnection);

    const res = await request(app)
      .post('/api/service-profiles/create')
      .set('Authorization', `Bearer ${signToken(42)}`)
      .field('fullName', 'Provider Mismatch')
      .field('barangayAddress', 'Poblacion')
      .field('startingPrice', '900')
      .field('serviceCategories', JSON.stringify(['Plumbing']))
      .field('serviceTypes', JSON.stringify(['electrical_troubleshooting']));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/does not belong/i);
  });

  it('23) rejects booking with service type not offered by provider', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 10, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (sql.includes('SELECT') && sql.includes('FROM service_profiles sp')) {
        return [[{
          service_profile_id: 7,
          provider_id: 21,
          starting_price: '700.00',
          service_categories: JSON.stringify(['Plumbing']),
          service_types: JSON.stringify(['leak_repair']),
          is_published: 1,
          user_type: 'tradesperson',
          is_active: 1,
        }]];
      }
      return [[]];
    });

    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .post('/api/service-requests/create')
      .set('Authorization', `Bearer ${signToken(10)}`)
      .send({
        providerId: 21,
        serviceProfileId: 7,
        serviceTypeKey: 'electrical_troubleshooting',
        jobTitle: 'Fix breaker panel',
        jobDetails: 'Need urgent electrical work',
        serviceLocation: '123 Rizal St, Toledo City',
        bookingType: 'one_day',
        startDate: '2099-12-31',
        endDate: '2099-12-31',
        startTime: '09:00',
        estimatedDurationMinutes: 120,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not offered/i);
  });

  it('24) rejects creating/updating profile with legacy Repair category', async () => {
    const mockConnection = createConnectionMock(async (sql) => {
      return [[]];
    });

    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: 42, user_type: 'tradesperson', is_active: 1 }]];
      if (String(sql).includes('SELECT user_type, is_verified, is_active FROM users WHERE id = ? LIMIT 1')) {
        return [[{ user_type: 'tradesperson', is_verified: 1, is_active: 1 }]];
      }
      if (String(sql).includes('SELECT id, banner_image_public_id FROM service_profiles WHERE user_id = ?')) {
        return [[]];
      }
      return [[]];
    });

    vi.spyOn(db, 'getConnection').mockResolvedValue(mockConnection);

    const res = await request(app)
      .post('/api/service-profiles/create')
      .set('Authorization', `Bearer ${signToken(42)}`)
      .field('fullName', 'Provider Legacy')
      .field('barangayAddress', 'Poblacion')
      .field('startingPrice', '700')
      .field('serviceCategories', JSON.stringify(['Repair']));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/legacy category/i);
  });
});
