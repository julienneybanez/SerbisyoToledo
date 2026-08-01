const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const db = require('../config/database');
const app = require('../server');

const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
const authUserSql = 'SELECT id, user_type, is_active FROM users WHERE id = ? LIMIT 1';

describe('Settings-related backend endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns provider self profile with isPublished', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) {
        return [[{ id: 21, user_type: 'tradesperson', is_active: 1 }]];
      }

      if (sql.includes('FROM service_profiles sp') && sql.includes('WHERE sp.user_id = ?')) {
        return [[{
          id: 77,
          user_id: 21,
          full_name: 'Provider Name',
          barangay_address: 'Poblacion',
          starting_price: '500.00',
          description: 'Experienced technician',
          service_categories: JSON.stringify(['Plumbing']),
          banner_image: null,
          banner_image_url: null,
          rating: '5.00',
          reviews_count: 4,
          online: 1,
          is_published: 1,
          profession: 'Plumber',
          skills: JSON.stringify(['Repairs']),
          email: 'provider@example.com',
          phone: '09121231234',
          is_verified: 1,
          created_at: '2026-01-01 00:00:00',
        }]];
      }

      return [[]];
    });

    const res = await request(app)
      .get('/api/service-profiles/user/me')
      .set('Authorization', `Bearer ${signToken(21)}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('isPublished', true);
  });

  it('allows provider to toggle publish state', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) {
        return [[{ id: 21, user_type: 'tradesperson', is_active: 1 }]];
      }

      if (sql.includes('UPDATE service_profiles SET is_published = ? WHERE user_id = ?')) {
        return [{ affectedRows: 1 }];
      }

      return [[]];
    });

    const res = await request(app)
      .patch('/api/service-profiles/toggle-publish')
      .set('Authorization', `Bearer ${signToken(21)}`)
      .send({ isPublished: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/published successfully/i);
  });

  it('denies client access to provider publish toggle endpoint', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) {
        return [[{ id: 10, user_type: 'client', is_active: 1 }]];
      }

      return [[]];
    });

    const res = await request(app)
      .patch('/api/service-profiles/toggle-publish')
      .set('Authorization', `Bearer ${signToken(10)}`)
      .send({ isPublished: true });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('updates account profile fields used by settings', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) {
        return [[{ id: 10, user_type: 'client', is_active: 1 }]];
      }

      if (sql.includes('SELECT profile_photo_public_id FROM users WHERE id = ? LIMIT 1')) {
        return [[{ profile_photo_public_id: null }]];
      }

      if (sql.startsWith('UPDATE users SET')) {
        return [{ affectedRows: 1 }];
      }

      if (sql.includes('SELECT id, full_name, email, user_type, phone, address, bio, profile_photo, profile_photo_url')) {
        return [[{
          id: 10,
          full_name: 'Updated Client',
          email: 'client@example.com',
          user_type: 'client',
          phone: '09998887777',
          address: 'Updated Address',
          bio: 'Updated bio',
          profile_photo: null,
          profile_photo_url: null,
        }]];
      }

      return [[]];
    });

    const res = await request(app)
      .patch('/api/user/profile')
      .set('Authorization', `Bearer ${signToken(10)}`)
      .field('fullName', 'Updated Client')
      .field('phone', '09998887777')
      .field('address', 'Updated Address')
      .field('bio', 'Updated bio');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fullName).toBe('Updated Client');
    expect(res.body.data.bio).toBe('Updated bio');
  });
});
