const request = require('supertest');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'serbisyo_session';

const db = require('../config/database');
const app = require('../server');
const configureSocket = require('../realtime/socket');

const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
const signSocketTicket = (userId, scope = 'socket', expiresIn = '60s') =>
  jwt.sign({ userId, scope }, process.env.JWT_SECRET, { expiresIn });

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME;

describe('Socket.IO Authentication & Ticket Integration', () => {
  let httpServer;
  let io;
  let serverAddress;

  beforeAll(async () => {
    httpServer = http.createServer(app);
    io = new Server(httpServer, {
      cors: { origin: '*' }
    });
    configureSocket(io);

    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        const port = httpServer.address().port;
        serverAddress = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (io) io.close();
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/auth/socket-ticket requires authentication (returns 401 when no token)', async () => {
    const res = await request(app).get('/api/auth/socket-ticket');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/auth/socket-ticket returns short-lived ticket with correct userId and scope: socket', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (String(sql).includes('SELECT id, user_type, is_active FROM users')) {
        return [[{ id: 42, user_type: 'client', is_active: 1 }]];
      }
      return [[]];
    });

    const sessionCookie = signToken(42);
    const res = await request(app)
      .get('/api/auth/socket-ticket')
      .set('Cookie', [`${AUTH_COOKIE_NAME}=${sessionCookie}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ticket).toBeDefined();

    const decoded = jwt.verify(res.body.data.ticket, process.env.JWT_SECRET);
    expect(decoded.userId).toBe(42);
    expect(decoded.scope).toBe('socket');
  });

  it('allows real Socket.IO connection when valid ticket is supplied in auth.ticket', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (String(sql).includes('SELECT id, user_type, is_active FROM users')) {
        return [[{ id: 10, user_type: 'client', is_active: 1 }]];
      }
      if (String(sql).includes('UPDATE users SET is_online')) {
        return [{ affectedRows: 1 }];
      }
      return [[]];
    });

    const ticket = signSocketTicket(10, 'socket', '60s');
    const clientSocket = ioClient(serverAddress, {
      auth: { ticket },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        clientSocket.disconnect();
        resolve();
      });

      clientSocket.on('connect_error', (err) => {
        clientSocket.disconnect();
        reject(err);
      });
    });
  });

  it('rejects Socket.IO connection when ticket is malformed or invalid', async () => {
    const clientSocket = ioClient(serverAddress, {
      auth: { ticket: 'invalid-ticket-string' },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      clientSocket.on('connect', () => {
        clientSocket.disconnect();
        reject(new Error('Should not have connected with invalid ticket'));
      });

      clientSocket.on('connect_error', (err) => {
        expect(err.message).toBe('Authentication required');
        clientSocket.disconnect();
        resolve();
      });
    });
  });

  it('rejects Socket.IO connection when ticket is expired', async () => {
    const expiredTicket = jwt.sign({ userId: 10, scope: 'socket' }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    const clientSocket = ioClient(serverAddress, {
      auth: { ticket: expiredTicket },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      clientSocket.on('connect', () => {
        clientSocket.disconnect();
        reject(new Error('Should not have connected with expired ticket'));
      });

      clientSocket.on('connect_error', (err) => {
        expect(err.message).toBe('Authentication required');
        clientSocket.disconnect();
        resolve();
      });
    });
  });

  it('rejects Socket.IO connection when ticket belongs to an inactive user (is_active = 0)', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (String(sql).includes('SELECT id, user_type, is_active FROM users')) {
        return [[{ id: 10, user_type: 'client', is_active: 0 }]];
      }
      return [[]];
    });

    const ticket = signSocketTicket(10, 'socket', '60s');
    const clientSocket = ioClient(serverAddress, {
      auth: { ticket },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      clientSocket.on('connect', () => {
        clientSocket.disconnect();
        reject(new Error('Should not have connected with inactive user ticket'));
      });

      clientSocket.on('connect_error', (err) => {
        expect(err.message).toBe('Account unavailable');
        clientSocket.disconnect();
        resolve();
      });
    });
  });
});
