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

    // Get pending verifications count (tradespersons who are not verified)
    const [pendingVerificationsResult] = await db.query(
      "SELECT COUNT(*) as count FROM users WHERE user_type = 'tradesperson' AND is_verified = false"
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

    // Active reports (placeholder - you can create a reports table later)
    const activeReports = 0;

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
