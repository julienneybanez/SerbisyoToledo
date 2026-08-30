const db = require('../config/database');
const { getSignedDeliveryUrl } = require('../utils/cloudinaryService');

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    // Get total users count
    const [totalUsersResult] = await db.query('SELECT COUNT(*) as count FROM users');
    const totalUsers = totalUsersResult[0].count;

    // Get verified providers count (tradespersons who are verified)
    const [verifiedProvidersResult] = await db.query(
      "SELECT COUNT(*) as count FROM users WHERE user_type = 'tradesperson' AND is_verified = true"
    );
    const verifiedProviders = verifiedProvidersResult[0].count;

    // Get pending verification requests count from verification workflow table
    const [pendingVerificationsResult] = await db.query(
      "SELECT COUNT(*) as count FROM verification_requests WHERE status = 'pending'"
    );
    const pendingVerifications = pendingVerificationsResult[0].count;

    // Get count by user type
    const [clientsResult] = await db.query(
      "SELECT COUNT(*) as count FROM users WHERE user_type = 'client'"
    );
    const totalClients = clientsResult[0].count;

    const [tradespersonsResult] = await db.query(
      "SELECT COUNT(*) as count FROM users WHERE user_type = 'tradesperson'"
    );
    const totalTradespersons = tradespersonsResult[0].count;

    const [adminsResult] = await db.query(
      "SELECT COUNT(*) as count FROM users WHERE user_type = 'admin'"
    );
    const totalAdmins = adminsResult[0].count;

    // Active reports
    const [activeReportsResult] = await db.query(
      "SELECT COUNT(*) as count FROM user_reports WHERE status IN ('pending', 'under_review')"
    );
    const activeReports = activeReportsResult[0].count;

    res.json({
      success: true,
      data: {
        totalUsers,
        totalClients,
        totalTradespersons,
        totalAdmins,
        verifiedProviders,
        pendingVerifications,
        activeReports
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT id, full_name, email, user_type, profession, is_verified, is_active, created_at 
       FROM users 
       ORDER BY created_at DESC`
    );

    // Format the response
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.full_name,
      email: user.email,
      type: user.user_type,
      profession: user.profession,
      isVerified: user.is_verified,
      isActive: user.is_active,
      status: user.is_active ? (user.is_verified ? 'verified' : 'active') : 'suspended',
      joinDate: user.created_at
    }));

    res.json({
      success: true,
      data: formattedUsers
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const [users] = await db.query(
      `SELECT id, full_name, email, user_type, profession, phone, address, bio, 
              profile_image, is_verified, is_active, created_at 
       FROM users WHERE id = ?`,
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];
    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        type: user.user_type,
        profession: user.profession,
        phone: user.phone,
        address: user.address,
        bio: user.bio,
        profileImage: user.profile_image,
        isVerified: user.is_verified,
        isActive: user.is_active,
        joinDate: user.created_at
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update account activation state. Provider verification is intentionally
// handled only through the Verification Requests workflow so its audit trail
// cannot be bypassed from User Management.
exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isVerified, isActive } = req.body;

    if (typeof isVerified === 'boolean') {
      return res.status(409).json({
        success: false,
        code: 'USE_VERIFICATION_WORKFLOW',
        message: 'Provider verification must be changed through Verification Requests.'
      });
    }

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Account active status is required.'
      });
    }

    if (Number(id) === Number(req.user.userId) && !isActive) {
      return res.status(409).json({
        success: false,
        message: 'You cannot suspend your own administrator account.'
      });
    }

    const [users] = await db.query('SELECT id, user_type FROM users WHERE id = ? LIMIT 1', [id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await db.query(
      'UPDATE users SET is_active = ?, is_online = IF(?, is_online, FALSE) WHERE id = ?',
      [isActive, isActive, id]
    );

    if (!isActive && users[0].user_type === 'tradesperson') {
      await db.query('UPDATE service_profiles SET is_published = FALSE WHERE user_id = ?', [id]);
    }

    return res.json({
      success: true,
      message: isActive ? 'Account reactivated successfully' : 'Account suspended successfully'
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Legacy DELETE endpoint now performs a safe deactivation instead of physically
// deleting relational history. The later full schema redesign will formalize
// account anonymization/retention rules.
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (Number(id) === Number(req.user.userId)) {
      return res.status(409).json({
        success: false,
        message: 'You cannot deactivate your own administrator account.'
      });
    }

    const [users] = await db.query('SELECT id, user_type FROM users WHERE id = ? LIMIT 1', [id]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await db.query(
      'UPDATE users SET is_active = FALSE, is_online = FALSE, last_seen_at = NOW() WHERE id = ?',
      [id]
    );

    if (users[0].user_type === 'tradesperson') {
      await db.query('UPDATE service_profiles SET is_published = FALSE WHERE user_id = ?', [id]);
    }

    return res.json({
      success: true,
      message: 'Account deactivated. Booking, report, review, and moderation history was preserved.'
    });
  } catch (error) {
    console.error('Error deactivating user:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to deactivate user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get verification requests
exports.getVerificationRequests = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT vr.id, vr.user_id, vr.full_name, vr.phone_number, vr.address, vr.service_description,
              vr.government_id_data, vr.government_id_mime,
              vr.certifications_data, vr.certifications_mime,
              vr.status, vr.rejection_reason, vr.admin_notes, vr.created_at,
              u.email, u.profession
       FROM verification_requests vr
       JOIN users u ON vr.user_id = u.id
       ORDER BY
         CASE vr.status
           WHEN 'pending' THEN 1
           WHEN 'rejected' THEN 2
           WHEN 'approved' THEN 3
           ELSE 4
         END,
         vr.created_at DESC`
    );

    const requests = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name,
      email: row.email,
      profession: row.profession,
      phoneNumber: row.phone_number,
      address: row.address,
      serviceDescription: row.service_description,
      status: row.status,
      rejectionReason: row.rejection_reason,
      adminNotes: row.admin_notes,
      createdAt: row.created_at,
      documents: {
        governmentId: row.government_id_data
          ? `data:${row.government_id_mime || 'application/octet-stream'};base64,${Buffer.from(row.government_id_data).toString('base64')}`
          : null,
        certifications: row.certifications_data
          ? `data:${row.certifications_mime || 'application/octet-stream'};base64,${Buffer.from(row.certifications_data).toString('base64')}`
          : null,
      }
    }));

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching verification requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch verification requests',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Review verification request (approve/reject)
exports.reviewVerificationRequest = async (req, res) => {
  let connection;

  try {
    const { id } = req.params;
    const { action, rejectionReason, adminNotes } = req.body;
    const adminId = req.user.userId;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use approve or reject.'
      });
    }

    const trimmedReason = typeof rejectionReason === 'string' ? rejectionReason.trim() : '';
    if (action === 'reject' && !trimmedReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required when rejecting a request'
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [requests] = await connection.query(
      'SELECT id, user_id, status FROM verification_requests WHERE id = ? FOR UPDATE',
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Verification request not found'
      });
    }

    if (requests[0].status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending requests can be reviewed'
      });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const isVerified = action === 'approve';
    const notificationType = action === 'approve' ? 'verification_approved' : 'verification_rejected';
    const notificationTitle = action === 'approve' ? 'Verification Approved' : 'Verification Request Rejected';
    const notificationMessage = action === 'approve'
      ? 'Your service provider verification request has been approved.'
      : `Your service provider verification request was rejected. Reason: ${trimmedReason}`;

    await connection.query(
      `UPDATE verification_requests
       SET status = ?, rejection_reason = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = NOW()
       WHERE id = ?`,
      [newStatus, action === 'reject' ? trimmedReason : null, typeof adminNotes === 'string' ? adminNotes.trim() || null : null, adminId, id]
    );

    await connection.query(
      'UPDATE users SET is_verified = ? WHERE id = ?',
      [isVerified, requests[0].user_id]
    );

    await connection.query(
      `INSERT INTO notifications (user_id, type, title, message, related_request_id)
       VALUES (?, ?, ?, ?, NULL)`,
      [requests[0].user_id, notificationType, notificationTitle, notificationMessage]
    );

    await connection.commit();

    res.json({
      success: true,
      message: `Verification request ${newStatus} successfully`
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Error reviewing verification request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review verification request'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Get user activity summary for admin view
exports.getUserActivity = async (req, res) => {
  try {
    const { id } = req.params;

    const [requestStats] = await db.query(
      `SELECT
          COUNT(*) as totalRequests,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedRequests,
          SUM(CASE WHEN status IN ('pending', 'accepted', 'on_the_way', 'in_progress') THEN 1 ELSE 0 END) as activeRequests,
          MAX(created_at) as lastRequestActivity
       FROM service_requests
       WHERE client_id = ? OR provider_id = ?`,
      [id, id]
    );

    const [reportStats] = await db.query(
      `SELECT
          SUM(CASE WHEN reporter_id = ? THEN 1 ELSE 0 END) as reportsSubmitted,
          SUM(CASE WHEN reported_user_id = ? THEN 1 ELSE 0 END) as reportsReceived,
          MAX(created_at) as lastReportActivity
       FROM user_reports
       WHERE reporter_id = ? OR reported_user_id = ?`,
      [id, id, id, id]
    );

    const [recentRequests] = await db.query(
      `SELECT id,
              COALESCE(service_type_label, 'Service Request') AS service_label,
              status,
              start_date AS scheduled_date,
              created_at
       FROM service_requests
       WHERE client_id = ? OR provider_id = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [id, id]
    );

    res.json({
      success: true,
      data: {
        summary: {
          totalRequests: Number(requestStats[0]?.totalRequests || 0),
          completedRequests: Number(requestStats[0]?.completedRequests || 0),
          activeRequests: Number(requestStats[0]?.activeRequests || 0),
          reportsSubmitted: Number(reportStats[0]?.reportsSubmitted || 0),
          reportsReceived: Number(reportStats[0]?.reportsReceived || 0),
          lastRequestActivity: requestStats[0]?.lastRequestActivity || null,
          lastReportActivity: reportStats[0]?.lastReportActivity || null,
        },
        recentRequests,
      }
    });
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user activity',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get reports for moderation
exports.getReports = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.id, r.request_id, r.reason, r.description, r.status, r.priority, r.resolution_notes,
              r.report_status, r.action_taken, r.moderation_notes,
              r.screenshot_data, r.screenshot_mime, r.created_at,
              reporter.full_name as reporter_name, reporter.user_type as reporter_type,
              reported.full_name as reported_user_name, reported.user_type as reported_user_type,
              COALESCE(sr.service_type_label, 'Service Request') AS service_label
       FROM user_reports r
       JOIN users reporter ON r.reporter_id = reporter.id
       JOIN users reported ON r.reported_user_id = reported.id
       JOIN service_requests sr ON r.request_id = sr.id
       ORDER BY
         CASE COALESCE(r.report_status, r.status)
           WHEN 'pending' THEN 1
           WHEN 'under_review' THEN 2
           WHEN 'dismissed' THEN 3
           WHEN 'resolved' THEN 4
           ELSE 6
         END,
         r.created_at DESC`
    );

    const reports = rows.map((row) => ({
      id: row.id,
      requestId: row.request_id,
      reportedUser: row.reported_user_name,
      reportedUserType: row.reported_user_type,
      status: row.report_status || row.status,
      actionTaken: row.action_taken || 'none',
      reportedBy: row.reporter_name,
      reporterType: row.reporter_type,
      reason: row.reason,
      description: row.description,
      priority: row.priority,
      resolution: row.resolution_notes,
      moderationNotes: row.moderation_notes,
      date: row.created_at,
      serviceLabel: row.service_label,
      screenshot: row.screenshot_data
        ? `data:${row.screenshot_mime || 'image/jpeg'};base64,${Buffer.from(row.screenshot_data).toString('base64')}`
        : null,
    }));

    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update report moderation status
exports.updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, resolutionNotes, moderationNotes } = req.body;
    const adminId = req.user.userId;

    if (!['investigate', 'dismiss', 'resolve', 'warn', 'suspend', 'ban'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action.'
      });
    }

    const [reports] = await db.query(
      'SELECT id, reported_user_id, COALESCE(report_status, status) AS lifecycle_status FROM user_reports WHERE id = ?',
      [id]
    );

    if (reports.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    const currentStatus = reports[0].lifecycle_status;
    if (['dismissed', 'resolved'].includes(currentStatus)) {
      return res.status(409).json({
        success: false,
        message: `Cannot apply action to a ${currentStatus} report`
      });
    }

    const trimmedResolution = String(resolutionNotes || '').trim();
    const trimmedModeration = String(moderationNotes || '').trim();

    let nextStatus = currentStatus;
    let nextActionTaken = 'none';

    if (action === 'investigate') {
      nextStatus = 'under_review';
    }

    if (action === 'dismiss') {
      nextStatus = 'dismissed';
    }

    if (action === 'resolve') {
      nextStatus = 'resolved';
    }

    if (['warn', 'suspend', 'ban'].includes(action)) {
      nextStatus = 'resolved';
      nextActionTaken = action === 'warn' ? 'warning' : action;
    }

    if (['dismiss', 'resolve', 'warn', 'suspend', 'ban'].includes(action) && !trimmedResolution) {
      return res.status(400).json({
        success: false,
        message: 'Resolution notes are required for this action.'
      });
    }

    if (currentStatus === nextStatus) {
      return res.status(409).json({
        success: false,
        message: `Report is already marked as ${nextStatus}`
      });
    }

    await db.query(
      `UPDATE user_reports
       SET report_status = ?,
           action_taken = ?,
           resolution_notes = ?,
           moderation_notes = ?,
           handled_by = ?,
           handled_at = NOW()
       WHERE id = ?`,
      [nextStatus, nextActionTaken, trimmedResolution || null, trimmedModeration || null, adminId, id]
    );

    if (action === 'ban') {
      await db.query(
        'UPDATE users SET is_active = FALSE WHERE id = ?',
        [reports[0].reported_user_id]
      );
    }

    if (action === 'suspend') {
      await db.query(
        'UPDATE users SET is_active = FALSE WHERE id = ?',
        [reports[0].reported_user_id]
      );
    }

    res.json({
      success: true,
      message: `Report updated: ${nextStatus}${nextActionTaken !== 'none' ? ` (${nextActionTaken})` : ''}`
    });
  } catch (error) {
    console.error('Error updating report status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update report status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getProviderCredentials = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT pc.id, pc.service_profile_id, pc.credential_name, pc.credential_type,
              pc.issuing_organization, pc.credential_id, pc.issue_date, pc.expiration_date,
              pc.does_not_expire, pc.credential_url, pc.related_skills,
              pc.document_url, pc.document_public_id,
              pc.verification_status, pc.verification_notes, pc.created_at, pc.updated_at,
              pc.reviewed_by, pc.reviewed_at,
              u.id AS provider_user_id,
              u.full_name AS provider_user_name,
              reviewer.full_name AS reviewer_name
       FROM provider_credentials pc
       JOIN service_profiles sp ON sp.id = pc.service_profile_id
       JOIN users u ON u.id = sp.user_id
       LEFT JOIN users reviewer ON reviewer.id = pc.reviewed_by
       ORDER BY
         CASE pc.verification_status
           WHEN 'pending' THEN 1
           WHEN 'unverified' THEN 2
           WHEN 'rejected' THEN 3
           WHEN 'verified' THEN 4
           WHEN 'expired' THEN 5
           ELSE 6
         END,
         pc.created_at DESC`
    );

    const credentials = rows.map((row) => ({
      id: row.id,
      serviceProfileId: row.service_profile_id,
      provider: {
        userId: row.provider_user_id,
        name: row.provider_user_name,
        profileName: row.provider_user_name,
      },
      credentialName: row.credential_name,
      credentialType: row.credential_type,
      issuingOrganization: row.issuing_organization,
      credentialId: row.credential_id,
      issueDate: row.issue_date,
      expirationDate: row.expiration_date,
      doesNotExpire: Boolean(row.does_not_expire),
      credentialUrl: row.credential_url,
      relatedSkills: (() => {
        try {
          return row.related_skills ? JSON.parse(row.related_skills) : [];
        } catch {
          return [];
        }
      })(),
      verificationStatus: row.verification_status,
      verificationNotes: row.verification_notes,
      reviewedBy: row.reviewed_by,
      reviewerName: row.reviewer_name,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      document: row.document_public_id
        ? getSignedDeliveryUrl(row.document_public_id)
        : (row.document_url || null),
    }));

    return res.json({
      success: true,
      data: credentials,
    });
  } catch (error) {
    console.error('Error fetching provider credentials:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch provider credentials',
    });
  }
};

exports.reviewProviderCredential = async (req, res) => {
  try {
    const credentialId = Number(req.params.id);
    const adminId = req.user.userId;
    const { action, reason } = req.body;

    if (!credentialId) {
      return res.status(400).json({ success: false, message: 'Invalid credential id' });
    }

    if (!['approve', 'reject', 'expire'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid review action' });
    }

    const reviewReason = String(reason || '').trim();
    if (action === 'reject' && !reviewReason) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    const [rows] = await db.query(
      `SELECT pc.id, pc.verification_status, sp.user_id AS provider_user_id, pc.credential_name
       FROM provider_credentials pc
       JOIN service_profiles sp ON sp.id = pc.service_profile_id
       WHERE pc.id = ?
       LIMIT 1`,
      [credentialId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Credential not found' });
    }

    let nextStatus = 'verified';
    if (action === 'reject') nextStatus = 'rejected';
    if (action === 'expire') nextStatus = 'expired';

    await db.query(
      `UPDATE provider_credentials
       SET verification_status = ?, verification_notes = ?, reviewed_by = ?, reviewed_at = NOW()
       WHERE id = ?`,
      [nextStatus, reviewReason || null, adminId, credentialId]
    );

    const notificationType = action === 'approve'
      ? 'credential_approved'
      : action === 'reject'
        ? 'credential_rejected'
        : 'credential_expired';
    const notificationTitle = action === 'approve'
      ? 'Credential Approved'
      : action === 'reject'
        ? 'Credential Rejected'
        : 'Credential Expired';
    const notificationMessage = action === 'approve'
      ? `Your credential "${rows[0].credential_name}" has been verified.`
      : action === 'reject'
        ? `Your credential "${rows[0].credential_name}" was rejected. Reason: ${reviewReason}`
        : `Your credential "${rows[0].credential_name}" is now marked as expired.`;

    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, related_request_id)
       VALUES (?, ?, ?, ?, NULL)`,
      [rows[0].provider_user_id, notificationType, notificationTitle, notificationMessage]
    );

    return res.json({
      success: true,
      message: `Credential ${nextStatus} successfully`
    });
  } catch (error) {
    console.error('Error reviewing provider credential:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to review credential'
    });
  }
};
