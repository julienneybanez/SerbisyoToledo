const db = require('../config/database');
const { normalizePhilippinePhone, toLocalPhilippinePhone } = require('../utils/phone');

const SHAREABLE_STATUSES = new Set(['accepted', 'on_the_way', 'in_progress']);

const getRequest = async (requestId, userId) => {
  const [rows] = await db.query(
    `SELECT sr.id, sr.client_id, sr.provider_id, sr.status,
            COALESCE(sr.service_type_label, 'Service Request') AS service_label,
            client.full_name AS client_name,
            provider.full_name AS provider_name
     FROM service_requests sr
     JOIN users client ON client.id = sr.client_id
     JOIN users provider ON provider.id = sr.provider_id
     WHERE sr.id = ? AND (sr.client_id = ? OR sr.provider_id = ?)
     LIMIT 1`,
    [requestId, userId, userId]
  );
  return rows[0] || null;
};

const counterpartId = (request, userId) => (
  request.client_id === userId ? request.provider_id : request.client_id
);

const emitConversationUpdated = async (req, request, eventType) => {
  const io = req.app.get('io');
  if (!io) return;

  const [rows] = await db.query(
    'SELECT id FROM conversations WHERE service_request_id = ? LIMIT 1',
    [request.id]
  );
  const conversationId = rows[0]?.id || null;
  const payload = {
    conversationId,
    serviceRequestId: request.id,
    requestStatus: request.status,
    eventType,
  };

  io.to('user:' + request.client_id).emit('conversation:updated', payload);
  io.to('user:' + request.provider_id).emit('conversation:updated', payload);
  if (conversationId) {
    io.to('conversation:' + conversationId).emit('conversation:updated', payload);
  }
};

exports.getPhoneShareState = async (req, res) => {
  try {
    const requestId = Number(req.params.requestId);
    const userId = req.user.userId;
    const request = await getRequest(requestId, userId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Service request not found.' });
    }

    const otherId = counterpartId(request, userId);
    const [rows] = await db.query(
      `SELECT id, requester_user_id, owner_user_id, status, requested_at, responded_at
       FROM service_request_contact_shares
       WHERE service_request_id = ? AND contact_type = 'phone'
        AND ((requester_user_id = ? AND owner_user_id = ?) OR (requester_user_id = ? AND owner_user_id = ?))`,
      [requestId, userId, otherId, otherId, userId]
    );

    const requestedByMe = rows.find((row) => row.requester_user_id === userId) || null;
    const requestedFromMe = rows.find((row) => row.owner_user_id === userId) || null;
    let sharedPhone = null;

    if (requestedByMe && requestedByMe.status === 'shared') {
      const [phoneRows] = await db.query('SELECT phone FROM users WHERE id = ? LIMIT 1', [otherId]);
      const normalized = normalizePhilippinePhone(phoneRows[0]?.phone);
      sharedPhone = normalized ? {
        e164: normalized,
        display: toLocalPhilippinePhone(normalized),
      } : null;
    }

    return res.json({
      success: true,
      data: {
        allowed: SHAREABLE_STATUSES.has(request.status),
        requestStatus: request.status,
        requestedByMe: requestedByMe ? {
          status: requestedByMe.status,
          requestedAt: requestedByMe.requested_at,
          respondedAt: requestedByMe.responded_at,
        } : null,
        requestedFromMe: requestedFromMe ? {
          status: requestedFromMe.status,
          requestedAt: requestedFromMe.requested_at,
          respondedAt: requestedFromMe.responded_at,
        } : null,
        sharedPhone,
      },
    });
  } catch (error) {
    console.error('Phone share state error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load phone-sharing status.' });
  }
};

exports.requestPhoneShare = async (req, res) => {
  try {
    const requestId = Number(req.params.requestId);
    const userId = req.user.userId;
    const request = await getRequest(requestId, userId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Service request not found.' });
    }
    if (!SHAREABLE_STATUSES.has(request.status)) {
      return res.status(409).json({
        success: false,
        message: 'Phone numbers can only be requested after the booking is accepted.',
      });
    }

    const ownerId = counterpartId(request, userId);
    const [existing] = await db.query(
      `SELECT id, status FROM service_request_contact_shares
      WHERE service_request_id = ? AND requester_user_id = ? AND owner_user_id = ?
         AND contact_type = 'phone'
       LIMIT 1`,
      [requestId, userId, ownerId]
    );

    if (existing[0] && existing[0].status === 'pending') {
      return res.status(409).json({ success: false, message: 'A phone-number request is already pending.' });
    }
    if (existing[0] && existing[0].status === 'shared') {
      return res.status(409).json({ success: false, message: 'This phone number has already been shared for the booking.' });
    }

    if (existing.length > 0) {
      await db.query(
        `UPDATE service_request_contact_shares
         SET status = 'pending', requested_at = NOW(), responded_at = NULL
         WHERE id = ?`,
        [existing[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO service_request_contact_shares
         (service_request_id, requester_user_id, owner_user_id, contact_type, status)
         VALUES (?, ?, ?, 'phone', 'pending')`,
        [requestId, userId, ownerId]
      );
    }

    const requesterName = request.client_id === userId ? request.client_name : request.provider_name;
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, related_request_id)
       VALUES (?, 'phone_share_requested', 'Phone Number Request', ?, ?)`,
      [
        ownerId,
        requesterName + ' requested your phone number for "' + request.service_label + '".',
        requestId,
      ]
    );

    await emitConversationUpdated(req, request, 'phone_requested');
    return res.status(201).json({ success: true, message: 'Phone-number request sent.' });
  } catch (error) {
    console.error('Request phone share error:', error);
    return res.status(500).json({ success: false, message: 'Failed to request phone number.' });
  }
};

exports.respondToPhoneShare = async (req, res) => {
  try {
    const requestId = Number(req.params.requestId);
    const ownerId = req.user.userId;
    const action = String(req.body?.action || '').toLowerCase();

    if (!['share', 'decline'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Choose share or decline.' });
    }

    const request = await getRequest(requestId, ownerId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Service request not found.' });
    }
    if (!SHAREABLE_STATUSES.has(request.status)) {
      return res.status(409).json({ success: false, message: 'Phone sharing is no longer available for this booking.' });
    }

    const requesterId = counterpartId(request, ownerId);
    const [rows] = await db.query(
      `SELECT id, status FROM service_request_contact_shares
      WHERE service_request_id = ? AND requester_user_id = ? AND owner_user_id = ?
         AND contact_type = 'phone'
       LIMIT 1`,
      [requestId, requesterId, ownerId]
    );

    if (rows.length === 0 || rows[0].status !== 'pending') {
      return res.status(409).json({ success: false, message: 'There is no pending phone-number request.' });
    }

    if (action === 'share') {
      const [phoneRows] = await db.query('SELECT phone FROM users WHERE id = ? LIMIT 1', [ownerId]);
      const normalized = normalizePhilippinePhone(phoneRows[0]?.phone);
      if (!normalized) {
        return res.status(400).json({
          success: false,
          code: 'NO_VALID_PHONE',
          message: 'Add a valid phone number in Settings before sharing it.',
        });
      }
    }

    const nextStatus = action === 'share' ? 'shared' : 'declined';
    await db.query(
      `UPDATE service_request_contact_shares
       SET status = ?, responded_at = NOW()
       WHERE id = ?`,
      [nextStatus, rows[0].id]
    );

    const ownerName = request.client_id === ownerId ? request.client_name : request.provider_name;
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, related_request_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        requesterId,
        action === 'share' ? 'phone_shared' : 'phone_share_declined',
        action === 'share' ? 'Phone Number Shared' : 'Phone Number Request Declined',
        action === 'share'
          ? ownerName + ' shared their phone number for "' + request.service_label + '". Open the request to view it.'
          : ownerName + ' declined the phone-number request for "' + request.service_label + '".',
        requestId,
      ]
    );

    await emitConversationUpdated(req, request, action === 'share' ? 'phone_shared' : 'phone_declined');

    return res.json({
      success: true,
      message: action === 'share' ? 'Phone number shared.' : 'Phone-number request declined.',
    });
  } catch (error) {
    console.error('Respond phone share error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update phone-sharing status.' });
  }
};
