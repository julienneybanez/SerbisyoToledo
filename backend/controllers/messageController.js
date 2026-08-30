const db = require('../config/database');

const WRITABLE_STATUSES = new Set(['pending', 'accepted', 'on_the_way', 'in_progress']);
const MAX_MESSAGE_LENGTH = 2000;

const ensureConversation = async (executor, requestId) => {
  await executor.query('INSERT IGNORE INTO conversations (service_request_id) VALUES (?)', [requestId]);
  const [rows] = await executor.query(
    'SELECT id, service_request_id FROM conversations WHERE service_request_id = ? LIMIT 1',
    [requestId]
  );
  return rows[0] || null;
};

exports.listConversations = async (req, res) => {
  try {
    const userId = req.user.userId;

    await db.query(
      `INSERT IGNORE INTO conversations (service_request_id)
       SELECT sr.id
       FROM service_requests sr
       WHERE (sr.client_id = ? OR sr.provider_id = ?)
         AND sr.status IN ('pending','accepted','on_the_way','in_progress')`,
      [userId, userId]
    );

    const [rows] = await db.query(
      `SELECT c.id, c.service_request_id, c.updated_at,
              sr.status AS request_status,
              COALESCE(sr.service_type_label, 'Service Request') AS service_label,
              CASE WHEN sr.client_id = ? THEN sr.provider_id ELSE sr.client_id END AS other_user_id,
              CASE WHEN sr.client_id = ? THEN provider.full_name ELSE client.full_name END AS other_user_name,
              CASE WHEN sr.client_id = ? THEN
                COALESCE(provider.profile_photo_url, provider.profile_image)
              ELSE
                COALESCE(client.profile_photo_url, client.profile_image)
              END AS other_user_photo,
              (SELECT m.message_text FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
              (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message_at,
              (SELECT COUNT(*) FROM messages m
                 WHERE m.conversation_id = c.id AND m.sender_id <> ? AND m.read_at IS NULL) AS unread_count
       FROM conversations c
       JOIN service_requests sr ON sr.id = c.service_request_id
       JOIN users client ON client.id = sr.client_id
       JOIN users provider ON provider.id = sr.provider_id
       WHERE sr.client_id = ? OR sr.provider_id = ?
       ORDER BY COALESCE(last_message_at, c.updated_at) DESC`,
      [userId, userId, userId, userId, userId, userId]
    );

    return res.json({
      success: true,
      data: {
        conversations: rows.map((row) => ({
          id: row.id,
          serviceRequestId: row.service_request_id,
          requestStatus: row.request_status,
          serviceLabel: row.service_label,
          otherUser: {
            id: row.other_user_id,
            name: row.other_user_name,
            profilePhoto: /^(https?:\/\/|data:image\/)/i.test(String(row.other_user_photo || '').trim())
              ? row.other_user_photo
              : null,
          },
          lastMessage: row.last_message,
          lastMessageAt: row.last_message_at,
          unreadCount: Number(row.unread_count || 0),
          writable: WRITABLE_STATUSES.has(row.request_status),
        })),
      },
    });
  } catch (error) {
    console.error('List conversations error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load conversations.' });
  }
};

exports.openRequestConversation = async (req, res) => {
  try {
    const userId = req.user.userId;
    const requestId = Number(req.params.requestId);
    if (!requestId) {
      return res.status(400).json({ success: false, message: 'Invalid service request.' });
    }

    const [requests] = await db.query(
      `SELECT id, status
       FROM service_requests
       WHERE id = ? AND (client_id = ? OR provider_id = ?)
       LIMIT 1`,
      [requestId, userId, userId]
    );

    if (requests.length === 0) {
      return res.status(404).json({ success: false, message: 'Service request not found.' });
    }

    if (!WRITABLE_STATUSES.has(requests[0].status)) {
      const [existing] = await db.query(
        'SELECT id FROM conversations WHERE service_request_id = ? LIMIT 1',
        [requestId]
      );
      if (existing.length === 0) {
        return res.status(409).json({
          success: false,
          message: 'This request is closed and has no conversation history.',
        });
      }
      return res.json({ success: true, data: { conversationId: existing[0].id } });
    }

    const conversation = await ensureConversation(db, requestId);
    return res.json({ success: true, data: { conversationId: conversation.id } });
  } catch (error) {
    console.error('Open request conversation error:', error);
    return res.status(500).json({ success: false, message: 'Failed to open conversation.' });
  }
};

exports.getConversationMessages = async (req, res) => {
  try {
    const userId = req.user.userId;
    const conversationId = Number(req.params.conversationId);
    const beforeId = req.query.beforeId ? Number(req.query.beforeId) : null;
    const limit = Math.min(Math.max(Number(req.query.limit || 60), 1), 100);

    const [conversationRows] = await db.query(
      `SELECT c.id, c.service_request_id, sr.client_id, sr.provider_id, sr.status,
              COALESCE(sr.service_type_label, 'Service Request') AS service_label,
              client.full_name AS client_name, provider.full_name AS provider_name,
              COALESCE(client.profile_photo_url, client.profile_image) AS client_photo,
              COALESCE(provider.profile_photo_url, provider.profile_image) AS provider_photo
       FROM conversations c
       JOIN service_requests sr ON sr.id = c.service_request_id
       JOIN users client ON client.id = sr.client_id
       JOIN users provider ON provider.id = sr.provider_id
       WHERE c.id = ? AND (sr.client_id = ? OR sr.provider_id = ?)
       LIMIT 1`,
      [conversationId, userId, userId]
    );

    if (conversationRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }

    const conversation = conversationRows[0];
    const params = [conversationId];
    let query = `SELECT m.id, m.conversation_id, m.sender_id, sender.full_name AS sender_name,
                        m.message_text, m.read_at, m.created_at
                 FROM messages m
                 JOIN users sender ON sender.id = m.sender_id
                 WHERE m.conversation_id = ?`;
    if (beforeId) {
      query += ' AND m.id < ?';
      params.push(beforeId);
    }
    query += ' ORDER BY m.id DESC LIMIT ?';
    params.push(limit);

    const [messages] = await db.query(query, params);

    return res.json({
      success: true,
      data: {
        conversation: {
          id: conversation.id,
          serviceRequestId: conversation.service_request_id,
          requestStatus: conversation.status,
          serviceLabel: conversation.service_label,
          writable: WRITABLE_STATUSES.has(conversation.status),
          otherUser: conversation.client_id === userId
            ? {
                id: conversation.provider_id,
                name: conversation.provider_name,
                profilePhoto: /^(https?:\/\/|data:image\/)/i.test(String(conversation.provider_photo || '').trim())
                  ? conversation.provider_photo
                  : null,
              }
            : {
                id: conversation.client_id,
                name: conversation.client_name,
                profilePhoto: /^(https?:\/\/|data:image\/)/i.test(String(conversation.client_photo || '').trim())
                  ? conversation.client_photo
                  : null,
              },
        },
        messages: messages.reverse().map((message) => ({
          id: message.id,
          conversationId: message.conversation_id,
          senderId: message.sender_id,
          senderName: message.sender_name,
          text: message.message_text,
          readAt: message.read_at,
          createdAt: message.created_at,
          mine: message.sender_id === userId,
        })),
      },
    });
  } catch (error) {
    console.error('Get conversation messages error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load messages.' });
  }
};

exports.sendMessage = async (req, res) => {
  let connection;
  try {
    const userId = req.user.userId;
    const conversationId = Number(req.params.conversationId);
    const messageText = String(req.body?.message || '').trim();

    if (!conversationId) {
      return res.status(400).json({ success: false, message: 'Invalid conversation.' });
    }
    if (!messageText || messageText.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: 'Message must be between 1 and ' + MAX_MESSAGE_LENGTH + ' characters.',
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT c.id, c.service_request_id, sr.client_id, sr.provider_id, sr.status,
              COALESCE(sr.service_type_label, 'Service Request') AS service_label,
              sender.full_name AS sender_name
       FROM conversations c
       JOIN service_requests sr ON sr.id = c.service_request_id
       JOIN users sender ON sender.id = ?
       WHERE c.id = ? AND (sr.client_id = ? OR sr.provider_id = ?)
       FOR UPDATE`,
      [userId, conversationId, userId, userId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }

    const conversation = rows[0];
    if (!WRITABLE_STATUSES.has(conversation.status)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: 'This conversation is read-only because the service request is closed.',
      });
    }

    const [insertResult] = await connection.query(
      'INSERT INTO messages (conversation_id, sender_id, message_text) VALUES (?, ?, ?)',
      [conversationId, userId, messageText]
    );
    await connection.query('UPDATE conversations SET updated_at = NOW() WHERE id = ?', [conversationId]);

    const recipientId = conversation.client_id === userId
      ? conversation.provider_id
      : conversation.client_id;

    await connection.query(
      `INSERT INTO notifications (user_id, type, title, message, related_request_id)
       VALUES (?, 'message_received', 'New Message', ?, ?)`,
      [
        recipientId,
        conversation.sender_name + ' sent you a message about "' + conversation.service_label + '".',
        conversation.service_request_id,
      ]
    );

    const [messageRows] = await connection.query(
      `SELECT m.id, m.conversation_id, m.sender_id, u.full_name AS sender_name,
              m.message_text, m.read_at, m.created_at
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.id = ? LIMIT 1`,
      [insertResult.insertId]
    );

    await connection.commit();

    const message = messageRows[0];
    const payload = {
      id: message.id,
      conversationId: message.conversation_id,
      senderId: message.sender_id,
      senderName: message.sender_name,
      text: message.message_text,
      readAt: message.read_at,
      createdAt: message.created_at,
    };

    const io = req.app.get('io');
    if (io) {
      io.to('conversation:' + conversationId).emit('message:new', payload);
      io.to('user:' + recipientId).emit('messages:unread-changed', { conversationId });
    }

    return res.status(201).json({ success: true, data: { message: payload } });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Send message error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send message.' });
  } finally {
    if (connection) connection.release();
  }
};

exports.markConversationRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const conversationId = Number(req.params.conversationId);

    const [rows] = await db.query(
      `SELECT c.id
       FROM conversations c
       JOIN service_requests sr ON sr.id = c.service_request_id
       WHERE c.id = ? AND (sr.client_id = ? OR sr.provider_id = ?)
       LIMIT 1`,
      [conversationId, userId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }

    await db.query(
      'UPDATE messages SET read_at = COALESCE(read_at, NOW()) WHERE conversation_id = ? AND sender_id <> ? AND read_at IS NULL',
      [conversationId, userId]
    );

    const io = req.app.get('io');
    if (io) {
      io.to('conversation:' + conversationId).emit('messages:read', {
        conversationId,
        readerId: userId,
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Mark conversation read error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update message read state.' });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const [rows] = await db.query(
      `SELECT COUNT(*) AS unread_count
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       JOIN service_requests sr ON sr.id = c.service_request_id
       WHERE (sr.client_id = ? OR sr.provider_id = ?)
         AND m.sender_id <> ? AND m.read_at IS NULL`,
      [userId, userId, userId]
    );
    return res.json({ success: true, data: { count: Number(rows[0]?.unread_count || 0) } });
  } catch (error) {
    console.error('Unread message count error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load unread message count.' });
  }
};
