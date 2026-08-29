const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const db = require('../config/database');
const app = require('../server');

const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

const authUserSql = 'SELECT id, user_type, is_active FROM users WHERE id = ? LIMIT 1';

const CLIENT_ID = 10;
const PROVIDER_ID = 21;

const baseRequestRow = (status) => ({
  id: 55,
  client_id: CLIENT_ID,
  provider_id: PROVIDER_ID,
  status,
  service_label: 'Plumbing Repair',
  client_name: 'Client One',
  provider_name: 'Provider One',
});

describe('Phone/contact sharing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hides the phone by default (no shared contact-share row)', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
      if (String(sql).includes('FROM service_requests sr') && String(sql).includes('JOIN users client')) {
        return [[baseRequestRow('accepted')]];
      }
      if (String(sql).includes('FROM service_request_contact_shares')) return [[]];
      return [[]];
    });

    const res = await request(app)
      .get('/api/service-requests/55/phone-share')
      .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.sharedPhone).toBeNull();
  });

  it('rejects a phone-share request while the booking is Pending', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
      if (String(sql).includes('FROM service_requests sr') && String(sql).includes('JOIN users client')) {
        return [[baseRequestRow('pending')]];
      }
      return [[]];
    });

    const res = await request(app)
      .post('/api/service-requests/55/phone-share/request')
      .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`);

    expect(res.status).toBe(409);
  });

  it.each(['accepted', 'on_the_way', 'in_progress'])(
    'allows requesting the phone number once status is %s',
    async (status) => {
      vi.spyOn(db, 'query').mockImplementation(async (sql) => {
        if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
        if (String(sql).includes('FROM service_requests sr') && String(sql).includes('JOIN users client')) {
          return [[baseRequestRow(status)]];
        }
        if (String(sql).includes('FROM service_request_contact_shares')) return [[]];
        if (String(sql).includes('INSERT INTO service_request_contact_shares')) return [{ insertId: 1 }];
        if (String(sql).includes('INSERT INTO notifications')) return [{ insertId: 2 }];
        return [[]];
      });

      const res = await request(app)
        .post('/api/service-requests/55/phone-share/request')
        .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`);

      expect(res.status).toBe(201);
    }
  );

  it('only the phone owner may respond to a pending phone-share request', async () => {
    // The requester (client) attempts to respond to their own request instead of the owner (provider).
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
      if (String(sql).includes('FROM service_requests sr') && String(sql).includes('JOIN users client')) {
        return [[baseRequestRow('accepted')]];
      }
      if (String(sql).includes('FROM service_request_contact_shares')) {
        // Looking for a request from the counterpart (provider) to this actor (client) -> none exists,
        // because the pending request in this scenario was made BY the client, not TO the client.
        return [[]];
      }
      return [[]];
    });

    const res = await request(app)
      .patch('/api/service-requests/55/phone-share/respond')
      .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`)
      .send({ action: 'share' });

    expect(res.status).toBe(409);
  });

  it('owner can share their phone number after Accepted', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: PROVIDER_ID, user_type: 'tradesperson', is_active: 1 }]];
      if (String(sql).includes('FROM service_requests sr') && String(sql).includes('JOIN users client')) {
        return [[baseRequestRow('accepted')]];
      }
      if (String(sql).includes('FROM service_request_contact_shares')) {
        return [[{ id: 1, status: 'pending' }]];
      }
      if (String(sql).includes('SELECT phone FROM users WHERE id = ?')) {
        return [[{ phone: '09171234567' }]];
      }
      if (String(sql).includes('UPDATE service_request_contact_shares')) return [{ affectedRows: 1 }];
      if (String(sql).includes('INSERT INTO notifications')) return [{ insertId: 2 }];
      return [[]];
    });

    const res = await request(app)
      .patch('/api/service-requests/55/phone-share/respond')
      .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`)
      .send({ action: 'share' });

    expect(res.status).toBe(200);
  });

  it('owner can decline a pending phone-share request', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: PROVIDER_ID, user_type: 'tradesperson', is_active: 1 }]];
      if (String(sql).includes('FROM service_requests sr') && String(sql).includes('JOIN users client')) {
        return [[baseRequestRow('accepted')]];
      }
      if (String(sql).includes('FROM service_request_contact_shares')) {
        return [[{ id: 1, status: 'pending' }]];
      }
      if (String(sql).includes('UPDATE service_request_contact_shares')) return [{ affectedRows: 1 }];
      if (String(sql).includes('INSERT INTO notifications')) return [{ insertId: 2 }];
      return [[]];
    });

    const res = await request(app)
      .patch('/api/service-requests/55/phone-share/respond')
      .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`)
      .send({ action: 'decline' });

    expect(res.status).toBe(200);
  });

  it('does not embed the raw phone number in the phone-share notification text', async () => {
    let insertedNotification = null;
    vi.spyOn(db, 'query').mockImplementation(async (sql, params) => {
      if (sql === authUserSql) return [[{ id: PROVIDER_ID, user_type: 'tradesperson', is_active: 1 }]];
      if (String(sql).includes('FROM service_requests sr') && String(sql).includes('JOIN users client')) {
        return [[baseRequestRow('accepted')]];
      }
      if (String(sql).includes('FROM service_request_contact_shares')) {
        return [[{ id: 1, status: 'pending' }]];
      }
      if (String(sql).includes('SELECT phone FROM users WHERE id = ?')) {
        return [[{ phone: '09171234567' }]];
      }
      if (String(sql).includes('UPDATE service_request_contact_shares')) return [{ affectedRows: 1 }];
      if (String(sql).includes('INSERT INTO notifications')) {
        insertedNotification = params;
        return [{ insertId: 2 }];
      }
      return [[]];
    });

    const res = await request(app)
      .patch('/api/service-requests/55/phone-share/respond')
      .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`)
      .send({ action: 'share' });

    expect(res.status).toBe(200);
    expect(insertedNotification).toBeTruthy();
    const notificationMessage = insertedNotification[3];
    expect(notificationMessage).not.toMatch(/09171234567/);
    expect(notificationMessage).not.toMatch(/\+639171234567/);
  });

  it('rejects sharing when the owner has no valid Philippine phone number on file', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: PROVIDER_ID, user_type: 'tradesperson', is_active: 1 }]];
      if (String(sql).includes('FROM service_requests sr') && String(sql).includes('JOIN users client')) {
        return [[baseRequestRow('accepted')]];
      }
      if (String(sql).includes('FROM service_request_contact_shares')) {
        return [[{ id: 1, status: 'pending' }]];
      }
      if (String(sql).includes('SELECT phone FROM users WHERE id = ?')) {
        return [[{ phone: '12345' }]];
      }
      return [[]];
    });

    const res = await request(app)
      .patch('/api/service-requests/55/phone-share/respond')
      .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`)
      .send({ action: 'share' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NO_VALID_PHONE');
  });
});

describe('Philippine phone number normalization', () => {
  const { normalizePhilippinePhone } = require('../utils/phone');

  it('accepts a valid 09xxxxxxxxx mobile number', () => {
    expect(normalizePhilippinePhone('09171234567')).toBe('+639171234567');
  });

  it('accepts a valid +639xxxxxxxxx mobile number', () => {
    expect(normalizePhilippinePhone('+639171234567')).toBe('+639171234567');
  });

  it('rejects an invalid/short phone number', () => {
    expect(normalizePhilippinePhone('12345')).toBeUndefined();
  });

  it('rejects a landline-style or foreign number', () => {
    expect(normalizePhilippinePhone('+14155552671')).toBeUndefined();
  });
});
