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

const CLIENT_ID = 10;
const PROVIDER_ID = 21;
const OUTSIDER_ID = 999;

describe('Messages authorization and lifecycle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('denies a non-participant from opening a request conversation', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: OUTSIDER_ID, user_type: 'client', is_active: 1 }]];
      if (String(sql).includes('FROM service_requests') && String(sql).includes('WHERE id = ? AND (client_id = ? OR provider_id = ?)')) {
        return [[]];
      }
      return [[]];
    });

    const res = await request(app)
      .post('/api/messages/request/55/open')
      .set('Authorization', `Bearer ${signToken(OUTSIDER_ID)}`);

    expect(res.status).toBe(404);
  });

  it('denies a non-participant from reading conversation messages', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: OUTSIDER_ID, user_type: 'client', is_active: 1 }]];
      if (String(sql).includes('FROM conversations c') && String(sql).includes('JOIN service_requests sr')) {
        return [[]];
      }
      return [[]];
    });

    const res = await request(app)
      .get('/api/messages/5/messages')
      .set('Authorization', `Bearer ${signToken(OUTSIDER_ID)}`);

    expect(res.status).toBe(404);
  });

  it('denies a non-participant from sending a message', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: OUTSIDER_ID, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (String(sql).includes('FOR UPDATE')) return [[]];
      return [[]];
    });
    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .post('/api/messages/5/messages')
      .set('Authorization', `Bearer ${signToken(OUTSIDER_ID)}`)
      .send({ message: 'hello' });

    expect(res.status).toBe(404);
  });

  it.each(['pending', 'accepted', 'on_the_way', 'in_progress'])(
    'allows a participant to send a message while request status is %s',
    async (status) => {
      vi.spyOn(db, 'query').mockImplementation(async (sql) => {
        if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
        return [[]];
      });

      const conn = createConnectionMock(async (sql) => {
        if (String(sql).includes('FOR UPDATE')) {
          return [[{
            id: 5,
            service_request_id: 55,
            client_id: CLIENT_ID,
            provider_id: PROVIDER_ID,
            status,
            service_label: 'Plumbing Repair',
            sender_name: 'Client One',
          }]];
        }
        if (String(sql).includes('INSERT INTO messages')) return [{ insertId: 900 }];
        if (String(sql).includes('SELECT m.id, m.conversation_id, m.sender_id, u.full_name')) {
          return [[{
            id: 900,
            conversation_id: 5,
            sender_id: CLIENT_ID,
            sender_name: 'Client One',
            message_text: 'hello',
            read_at: null,
            created_at: '2026-08-30T00:00:00.000Z',
          }]];
        }
        return [[]];
      });
      vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

      const res = await request(app)
        .post('/api/messages/5/messages')
        .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`)
        .send({ message: 'hello' });

      expect(res.status).toBe(201);
      expect(res.body.data.message.text).toBe('hello');
    }
  );

  it.each(['completed', 'declined', 'cancelled'])(
    'rejects sending a message once the request is %s (read-only)',
    async (status) => {
      vi.spyOn(db, 'query').mockImplementation(async (sql) => {
        if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
        return [[]];
      });

      const conn = createConnectionMock(async (sql) => {
        if (String(sql).includes('FOR UPDATE')) {
          return [[{
            id: 5,
            service_request_id: 55,
            client_id: CLIENT_ID,
            provider_id: PROVIDER_ID,
            status,
            service_label: 'Plumbing Repair',
            sender_name: 'Client One',
          }]];
        }
        return [[]];
      });
      vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

      const res = await request(app)
        .post('/api/messages/5/messages')
        .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`)
        .send({ message: 'hello' });

      expect(res.status).toBe(409);
      expect(conn.rollback).toHaveBeenCalled();
    }
  );

  it('rejects an empty message', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
      return [[]];
    });
    vi.spyOn(db, 'getConnection').mockResolvedValue(createConnectionMock(async () => [[]]));

    const res = await request(app)
      .post('/api/messages/5/messages')
      .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`)
      .send({ message: '   ' });

    expect(res.status).toBe(400);
  });

  it('rejects a message beyond the 2000 character limit', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
      return [[]];
    });
    vi.spyOn(db, 'getConnection').mockResolvedValue(createConnectionMock(async () => [[]]));

    const res = await request(app)
      .post('/api/messages/5/messages')
      .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`)
      .send({ message: 'a'.repeat(2001) });

    expect(res.status).toBe(400);
  });

  it('accepts a message exactly at the 2000 character limit', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const longText = 'a'.repeat(2000);
    const conn = createConnectionMock(async (sql) => {
      if (String(sql).includes('FOR UPDATE')) {
        return [[{
          id: 5,
          service_request_id: 55,
          client_id: CLIENT_ID,
          provider_id: PROVIDER_ID,
          status: 'accepted',
          service_label: 'Plumbing Repair',
          sender_name: 'Client One',
        }]];
      }
      if (String(sql).includes('INSERT INTO messages')) return [{ insertId: 901 }];
      if (String(sql).includes('SELECT m.id, m.conversation_id, m.sender_id, u.full_name')) {
        return [[{
          id: 901,
          conversation_id: 5,
          sender_id: CLIENT_ID,
          sender_name: 'Client One',
          message_text: longText,
          read_at: null,
          created_at: '2026-08-30T00:00:00.000Z',
        }]];
      }
      return [[]];
    });
    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);

    const res = await request(app)
      .post('/api/messages/5/messages')
      .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`)
      .send({ message: longText });

    expect(res.status).toBe(201);
  });

  it('persists the message via MySQL regardless of realtime/socket availability', async () => {
    // No `io` app setting is configured in this test app instance, simulating a
    // temporary Socket.IO outage. The REST write path must still succeed.
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
      return [[]];
    });

    const conn = createConnectionMock(async (sql) => {
      if (String(sql).includes('FOR UPDATE')) {
        return [[{
          id: 5,
          service_request_id: 55,
          client_id: CLIENT_ID,
          provider_id: PROVIDER_ID,
          status: 'accepted',
          service_label: 'Plumbing Repair',
          sender_name: 'Client One',
        }]];
      }
      if (String(sql).includes('INSERT INTO messages')) return [{ insertId: 902 }];
      if (String(sql).includes('SELECT m.id, m.conversation_id, m.sender_id, u.full_name')) {
        return [[{
          id: 902,
          conversation_id: 5,
          sender_id: CLIENT_ID,
          sender_name: 'Client One',
          message_text: 'no socket needed',
          read_at: null,
          created_at: '2026-08-30T00:00:00.000Z',
        }]];
      }
      return [[]];
    });
    vi.spyOn(db, 'getConnection').mockResolvedValue(conn);
    expect(app.get('io')).toBeFalsy();

    const res = await request(app)
      .post('/api/messages/5/messages')
      .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`)
      .send({ message: 'no socket needed' });

    expect(res.status).toBe(201);
    expect(conn.commit).toHaveBeenCalled();
  });

  it('marks messages read only for a participant and updates unread state', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: PROVIDER_ID, user_type: 'tradesperson', is_active: 1 }]];
      if (String(sql).includes('FROM conversations c') && String(sql).includes('JOIN service_requests sr')) {
        return [[{ id: 5 }]];
      }
      if (String(sql).includes('UPDATE messages SET read_at')) return [{ affectedRows: 2 }];
      return [[]];
    });

    const res = await request(app)
      .patch('/api/messages/5/read')
      .set('Authorization', `Bearer ${signToken(PROVIDER_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('denies marking a conversation read for a non-participant', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) return [[{ id: OUTSIDER_ID, user_type: 'client', is_active: 1 }]];
      if (String(sql).includes('FROM conversations c') && String(sql).includes('JOIN service_requests sr')) {
        return [[]];
      }
      return [[]];
    });

    const res = await request(app)
      .patch('/api/messages/5/read')
      .set('Authorization', `Bearer ${signToken(OUTSIDER_ID)}`);

    expect(res.status).toBe(404);
  });
  it('returns request decisions and phone-sharing changes in the durable conversation timeline', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      const text = String(sql);
      if (sql === authUserSql) {
        return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
      }
      if (text.includes('WHERE c.id = ?') && text.includes('client_photo')) {
        return [[{
          id: 5,
          service_request_id: 55,
          client_id: CLIENT_ID,
          provider_id: PROVIDER_ID,
          status: 'accepted',
          service_label: 'Plumbing Repair',
          client_name: 'Client One',
          provider_name: 'Provider One',
          client_photo: null,
          provider_photo: null,
        }]];
      }
      if (text.includes('FROM messages m') && text.includes('JOIN users sender')) {
        return [[{
          id: 1,
          conversation_id: 5,
          sender_id: CLIENT_ID,
          sender_name: 'Client One',
          message_text: 'Can we confirm the schedule?',
          read_at: null,
          created_at: '2026-08-31T01:00:00.000Z',
        }]];
      }
      if (text.includes('FROM service_request_status_history h')) {
        return [[{
          id: 11,
          to_status: 'accepted',
          changed_by: PROVIDER_ID,
          reason: null,
          created_at: '2026-08-31T01:05:00.000Z',
          actor_name: 'Provider One',
        }]];
      }
      if (text.includes('FROM service_request_contact_shares pcs')) {
        return [[{
          id: 12,
          requester_user_id: CLIENT_ID,
          owner_user_id: PROVIDER_ID,
          status: 'shared',
          requested_at: '2026-08-31T01:10:00.000Z',
          responded_at: '2026-08-31T01:12:00.000Z',
          requester_name: 'Client One',
          owner_name: 'Provider One',
        }]];
      }
      return [[]];
    });

    const res = await request(app)
      .get('/api/messages/5/messages')
      .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.conversation.viewerRole).toBe('client');
    expect(res.body.data.timeline.map((item) => item.eventType || item.kind)).toEqual([
      'message',
      'request_accepted',
      'phone_requested',
      'phone_shared',
    ]);
  });

  it('includes the other participant profile photo in the conversation list', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql === authUserSql) {
        return [[{ id: CLIENT_ID, user_type: 'client', is_active: 1 }]];
      }
      if (String(sql).includes('INSERT IGNORE INTO conversations')) {
        return [{ affectedRows: 0 }];
      }
      if (String(sql).includes('AS other_user_photo')) {
        return [[{
          id: 5,
          service_request_id: 55,
          request_status: 'accepted',
          service_label: 'Plumbing Repair',
          other_user_id: PROVIDER_ID,
          other_user_name: 'Provider One',
          other_user_photo: 'https://res.cloudinary.com/example/provider.jpg',
          last_message: 'See you tomorrow',
          last_message_at: '2026-08-30T00:00:00.000Z',
          unread_count: 0,
        }]];
      }
      return [[]];
    });

    const res = await request(app)
      .get('/api/messages')
      .set('Authorization', `Bearer ${signToken(CLIENT_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.conversations[0].otherUser.profilePhoto)
      .toBe('https://res.cloudinary.com/example/provider.jpg');
  });

});
