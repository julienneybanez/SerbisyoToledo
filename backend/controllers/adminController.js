const db = require('../config/database');

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

// Update user status (verify, activate, suspend)
exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isVerified, isActive } = req.body;

    const updates = [];
    const values = [];

    if (typeof isVerified === 'boolean') {
      updates.push('is_verified = ?');
      values.push(isVerified);
    }

    if (typeof isActive === 'boolean') {
      updates.push('is_active = ?');
      values.push(isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    values.push(id);
    await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'User status updated successfully'
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const [users] = await db.query('SELECT id FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await db.query('DELETE FROM users WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
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

    if (action === 'reject' && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required when rejecting a request'
      });
    }

    const [requests] = await db.query(
      'SELECT id, user_id, status FROM verification_requests WHERE id = ?',
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

    await db.query(
      `UPDATE verification_requests
       SET status = ?, rejection_reason = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = NOW()
       WHERE id = ?`,
      [newStatus, action === 'reject' ? rejectionReason : null, adminNotes || null, adminId, id]
    );

    await db.query(
      'UPDATE users SET is_verified = ? WHERE id = ?',
      [isVerified, requests[0].user_id]
    );

    res.json({
      success: true,
      message: `Verification request ${newStatus} successfully`
    });
  } catch (error) {
    console.error('Error reviewing verification request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review verification request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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
      `SELECT id, job_title, status, scheduled_date, created_at
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
              r.screenshot_data, r.screenshot_mime, r.created_at,
              reporter.full_name as reporter_name, reporter.user_type as reporter_type,
              reported.full_name as reported_user_name, reported.user_type as reported_user_type,
              sr.job_title
       FROM user_reports r
       JOIN users reporter ON r.reporter_id = reporter.id
       JOIN users reported ON r.reported_user_id = reported.id
       JOIN service_requests sr ON r.request_id = sr.id
       ORDER BY
         CASE r.status
           WHEN 'pending' THEN 1
           WHEN 'under_review' THEN 2
           WHEN 'dismissed' THEN 3
           WHEN 'resolved' THEN 4
           WHEN 'banned' THEN 5
           ELSE 6
         END,
         r.created_at DESC`
    );

    const reports = rows.map((row) => ({
      id: row.id,
      requestId: row.request_id,
      reportedUser: row.reported_user_name,
      reportedUserType: row.reported_user_type,
      status: row.status,
      reportedBy: row.reporter_name,
      reporterType: row.reporter_type,
      reason: row.reason,
      description: row.description,
      priority: row.priority,
      resolution: row.resolution_notes,
      date: row.created_at,
      jobTitle: row.job_title,
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
    const { action, resolutionNotes } = req.body;
    const adminId = req.user.userId;

    if (!['investigate', 'dismiss', 'ban'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use investigate, dismiss, or ban.'
      });
    }

    const [reports] = await db.query(
      'SELECT id, reported_user_id FROM user_reports WHERE id = ?',
      [id]
    );

    if (reports.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    let nextStatus = 'under_review';
    if (action === 'dismiss') nextStatus = 'dismissed';
    if (action === 'ban') nextStatus = 'banned';

    await db.query(
      `UPDATE user_reports
       SET status = ?, resolution_notes = ?, handled_by = ?, handled_at = NOW()
       WHERE id = ?`,
      [nextStatus, resolutionNotes || null, adminId, id]
    );

    if (action === 'ban') {
      await db.query(
        'UPDATE users SET is_active = FALSE WHERE id = ?',
        [reports[0].reported_user_id]
      );
    }

    res.json({
      success: true,
      message: `Report marked as ${nextStatus}`
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
