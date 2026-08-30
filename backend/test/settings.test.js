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

    const conn = {
      beginTransaction: vi.fn(async () => {}),
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
      release: vi.fn(() => {}),
      query: vi.fn(async (sql) => {
        if (String(sql).includes('FROM users WHERE id = ?')) {
          return [[{ is_verified: 1 }]];
        }
        if (String(sql).includes('FROM service_profiles WHERE id = ?') || String(sql).includes('FROM service_profiles WHERE user_id = ?')) {
          return [[{ id: 7, is_active: 1 }]];
        }
        if (String(sql).includes('FROM service_profile_categories')) {
          return [[{ count: 1 }]];
        }
        if (String(sql).includes('FROM service_profile_types')) {
          return [[{ count: 1 }]];
        }
        if (String(sql).includes('UPDATE service_profiles SET is_published')) {
          return [{ affectedRows: 1 }];
        }
        return [[]];
      }),
    };
    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

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

  it('saves simplified provider-selected availability with fixed system booking rules', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) {
        return [[{ id: 21, user_type: 'tradesperson', is_active: 1 }]];
      }

      if (sql.includes('SELECT id FROM service_profiles WHERE user_id = ? LIMIT 1')) {
        return [[{ id: 77 }]];
      }

      return [[]];
    });

    const connection = {
      beginTransaction: vi.fn(async () => {}),
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
      release: vi.fn(),
      query: vi.fn(async (sql) => {
        if (sql.includes('FROM provider_availability_settings') && sql.includes('LIMIT 1')) {
          return [[{
            id: 1,
            allow_same_day_booking: 0,
            min_advance_notice_minutes: 720,
            max_advance_booking_days: 60,
            availability_status: 'available',
            show_availability_status: 1,
          }]];
        }

        return [{ affectedRows: 1 }];
      }),
    };

    vi.spyOn(db, 'getConnection').mockResolvedValue(connection);

    const date = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));
    const futureDate = date.toISOString().slice(0, 10);

    const res = await request(app)
      .put('/api/service-profiles/availability/me')
      .set('Authorization', `Bearer ${signToken(21)}`)
      .send({
        acceptingBookings: true,
        availability: [
          { date: futureDate, startTime: '09:00', endTime: '11:00' },
          { date: futureDate, startTime: '13:00', endTime: '15:00' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      acceptingBookings: true,
      availabilityCount: 2,
      systemRules: {
        allowSameDayBooking: false,
        minAdvanceNoticeMinutes: 720,
        maxAdvanceBookingDays: 60,
      },
    });
    expect(connection.commit).toHaveBeenCalledTimes(1);

    const sqlCalls = connection.query.mock.calls.map(([sql]) => String(sql));
    expect(sqlCalls.some((sql) => sql.includes('DELETE FROM provider_weekly_availability'))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes('DELETE FROM provider_availability_exceptions'))).toBe(true);
    expect(sqlCalls.filter((sql) => sql.includes('INSERT INTO provider_available_slots'))).toHaveLength(2);
  });

  it('rejects overlapping provider-selected time slots on the same date', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) {
        return [[{ id: 21, user_type: 'tradesperson', is_active: 1 }]];
      }

      if (sql.includes('SELECT id FROM service_profiles WHERE user_id = ? LIMIT 1')) {
        return [[{ id: 77 }]];
      }

      return [[]];
    });

    const connection = {
      beginTransaction: vi.fn(async () => {}),
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
      release: vi.fn(),
      query: vi.fn(async (sql) => {
        if (sql.includes('FROM provider_availability_settings') && sql.includes('LIMIT 1')) {
          return [[{
            id: 1,
            allow_same_day_booking: 0,
            min_advance_notice_minutes: 720,
            max_advance_booking_days: 60,
            availability_status: 'available',
            show_availability_status: 1,
          }]];
        }
        return [{ affectedRows: 1 }];
      }),
    };

    vi.spyOn(db, 'getConnection').mockResolvedValue(connection);

    const date = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));
    const futureDate = date.toISOString().slice(0, 10);

    const res = await request(app)
      .put('/api/service-profiles/availability/me')
      .set('Authorization', `Bearer ${signToken(21)}`)
      .send({
        acceptingBookings: true,
        availability: [
          { date: futureDate, startTime: '09:00', endTime: '11:00' },
          { date: futureDate, startTime: '10:00', endTime: '12:00' },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/overlap/i);
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
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

      if (sql.includes('SELECT id, full_name, email, email_verified, user_type, phone, address, bio, profile_photo, profile_photo_url')) {
        return [[{
          id: 10,
          full_name: 'Updated Client',
          email: 'client@example.com',
          email_verified: 1,
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
