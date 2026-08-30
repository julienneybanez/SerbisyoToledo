const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { getJwtSecret } = require('../utils/jwt');
const { parseCookies, AUTH_COOKIE_NAME } = require('../utils/sessionCookies');

const configureSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      let userId = null;

      // 1. Try ticket in handshake auth first
      const ticket = socket.handshake.auth?.ticket;
      if (ticket) {
        try {
          const decoded = jwt.verify(ticket, getJwtSecret());
          if (decoded.scope === 'socket' && decoded.userId) {
            userId = decoded.userId;
          }
        } catch {
          // Ticket verification failed; fall back to cookie
        }
      }

      // 2. Fallback to HttpOnly session cookie
      if (!userId) {
        const cookies = parseCookies(socket.handshake.headers?.cookie || '');
        const token = cookies[AUTH_COOKIE_NAME];
        if (token) {
          const decoded = jwt.verify(token, getJwtSecret());
          userId = decoded.userId;
        }
      }

      if (!userId) {
        return next(new Error('Authentication required'));
      }

      const [users] = await db.query(
        'SELECT id, user_type, is_active FROM users WHERE id = ? LIMIT 1',
        [userId]
      );

      if (users.length === 0 || !users[0].is_active) {
        return next(new Error('Account unavailable'));
      }

      socket.user = {
        userId: users[0].id,
        userType: users[0].user_type,
      };
      return next();
    } catch {
      return next(new Error('Invalid session'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user.userId;
    socket.join('user:' + userId);

    try {
      await db.query(
        'UPDATE users SET is_online = TRUE, last_seen_at = NOW() WHERE id = ?',
        [userId]
      );
    } catch (error) {
      console.error('Socket presence connect error:', error);
    }

    socket.on('conversation:join', async (conversationId, acknowledgement) => {
      try {
        const id = Number(conversationId);
        if (!id) {
          if (typeof acknowledgement === 'function') acknowledgement({ success: false });
          return;
        }

        const [rows] = await db.query(
          `SELECT c.id
           FROM conversations c
           JOIN service_requests sr ON sr.id = c.service_request_id
           WHERE c.id = ? AND (sr.client_id = ? OR sr.provider_id = ?)
           LIMIT 1`,
          [id, userId, userId]
        );

        if (rows.length === 0) {
          if (typeof acknowledgement === 'function') acknowledgement({ success: false });
          return;
        }

        socket.join('conversation:' + id);
        if (typeof acknowledgement === 'function') acknowledgement({ success: true });
      } catch (error) {
        console.error('Socket conversation join error:', error);
        if (typeof acknowledgement === 'function') acknowledgement({ success: false });
      }
    });

    socket.on('conversation:leave', (conversationId) => {
      const id = Number(conversationId);
      if (id) socket.leave('conversation:' + id);
    });

    socket.on('disconnect', async () => {
      try {
        const sockets = await io.in('user:' + userId).fetchSockets();
        if (sockets.length === 0) {
          await db.query(
            'UPDATE users SET is_online = FALSE, last_seen_at = NOW() WHERE id = ?',
            [userId]
          );
        }
      } catch (error) {
        console.error('Socket presence disconnect error:', error);
      }
    });
  });
};

module.exports = configureSocket;
