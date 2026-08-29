const db = require('../config/database');

const verifyParticipant = async (requestId, userId) => {
  const [rows] = await db.query(
    `SELECT id, status
     FROM service_requests
     WHERE id = ? AND (client_id = ? OR provider_id = ?)
     LIMIT 1`,
    [requestId, userId, userId]
  );
  return rows[0] || null;
};

exports.archiveRequest = async (req, res) => {
  try {
    const requestId = Number(req.params.requestId);
    const userId = req.user.userId;
    const request = await verifyParticipant(requestId, userId);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Service request not found.' });
    }

    if (!['completed', 'declined', 'cancelled'].includes(request.status)) {
      return res.status(409).json({
        success: false,
        message: 'Only completed, declined, or cancelled requests can be archived.',
      });
    }

    await db.query(
      `INSERT INTO service_request_archives (service_request_id, user_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE archived_at = NOW()`,
      [requestId, userId]
    );

    return res.json({ success: true, message: 'Request archived.' });
  } catch (error) {
    console.error('Archive request error:', error);
    return res.status(500).json({ success: false, message: 'Failed to archive request.' });
  }
};

exports.unarchiveRequest = async (req, res) => {
  try {
    const requestId = Number(req.params.requestId);
    const userId = req.user.userId;
    const request = await verifyParticipant(requestId, userId);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Service request not found.' });
    }

    await db.query(
      'DELETE FROM service_request_archives WHERE service_request_id = ? AND user_id = ?',
      [requestId, userId]
    );

    return res.json({ success: true, message: 'Request restored.' });
  } catch (error) {
    console.error('Unarchive request error:', error);
    return res.status(500).json({ success: false, message: 'Failed to restore request.' });
  }
};
