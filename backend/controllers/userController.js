const db = require('../config/database');

// Get current user profile
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const [users] = await db.query(
      `SELECT id, full_name, email, user_type, phone, address, bio, profile_photo, created_at
       FROM users WHERE id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];
    
    // Convert profile_photo BLOB to base64 if exists
    let profilePhotoBase64 = null;
    if (user.profile_photo) {
      profilePhotoBase64 = `data:image/jpeg;base64,${user.profile_photo.toString('base64')}`;
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        userType: user.user_type,
        phone: user.phone,
        address: user.address,
        bio: user.bio,
        profilePhoto: profilePhotoBase64,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile'
    });
  }
};

// Update user profile (name, photo, phone, address, bio)
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { fullName, phone, address, bio } = req.body;
    let profilePhoto = null;

    // Handle profile photo upload if provided
    if (req.file) {
      profilePhoto = req.file.buffer;
    }

    // Build dynamic update query
    const updates = [];
    const params = [];

    if (fullName) {
      updates.push('full_name = ?');
      params.push(fullName);
    }

    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone || null);
    }

    if (address !== undefined) {
      updates.push('address = ?');
      params.push(address || null);
    }

    if (bio !== undefined) {
      updates.push('bio = ?');
      params.push(bio || null);
    }

    if (profilePhoto) {
      updates.push('profile_photo = ?');
      params.push(profilePhoto);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    params.push(userId);

    const [result] = await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Fetch updated user data
    const [users] = await db.query(
      `SELECT id, full_name, email, user_type, phone, address, bio, profile_photo
       FROM users WHERE id = ?`,
      [userId]
    );

    const user = users[0];
    let profilePhotoBase64 = null;
    if (user.profile_photo) {
      profilePhotoBase64 = `data:image/jpeg;base64,${user.profile_photo.toString('base64')}`;
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        userType: user.user_type,
        phone: user.phone,
        address: user.address,
        bio: user.bio,
        profilePhoto: profilePhotoBase64
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
};

// Remove profile photo
exports.removeProfilePhoto = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    await db.query(
      'UPDATE users SET profile_photo = NULL WHERE id = ?',
      [userId]
    );

    res.json({
      success: true,
      message: 'Profile photo removed successfully'
    });
  } catch (error) {
    console.error('Error removing profile photo:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing profile photo'
    });
  }
};
