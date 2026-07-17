const db = require('../config/database');
const {
  hasCloudinaryConfig,
  uploadImageBuffer,
  deleteImageByPublicId,
} = require('../utils/cloudinaryService');

const formatProfilePhoto = (user) => {
  if (user.profile_photo_url) {
    return user.profile_photo_url;
  }

  if (user.profile_photo) {
    return `data:image/jpeg;base64,${user.profile_photo.toString('base64')}`;
  }

  return null;
};

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
      `SELECT id, full_name, email, user_type, phone, address, bio, profile_photo, profile_photo_url, created_at
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
        profilePhoto: formatProfilePhoto(user),
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
    let profilePhotoUrl = null;
    let profilePhotoPublicId = null;

    const [existingUsers] = await db.query(
      'SELECT profile_photo_public_id FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    const previousPublicId = existingUsers[0]?.profile_photo_public_id;

    // Handle profile photo upload if provided
    if (req.file) {
      if (hasCloudinaryConfig()) {
        const uploadResult = await uploadImageBuffer({
          buffer: req.file.buffer,
          mimeType: req.file.mimetype,
          folder: 'serbisyo-toledo/profile-photos',
        });

        profilePhotoUrl = uploadResult.secure_url;
        profilePhotoPublicId = uploadResult.public_id;
      } else {
        profilePhoto = req.file.buffer;
      }
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

    if (profilePhotoUrl) {
      updates.push('profile_photo_url = ?');
      params.push(profilePhotoUrl);
      updates.push('profile_photo_public_id = ?');
      params.push(profilePhotoPublicId);
      updates.push('profile_image = ?');
      params.push(profilePhotoUrl);
      updates.push('profile_photo = NULL');
    } else if (profilePhoto) {
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
      `SELECT id, full_name, email, user_type, phone, address, bio, profile_photo, profile_photo_url
       FROM users WHERE id = ?`,
      [userId]
    );

    const user = users[0];

    if (profilePhotoPublicId && previousPublicId) {
      await deleteImageByPublicId(previousPublicId);
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
        profilePhoto: formatProfilePhoto(user)
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

    const [existingUsers] = await db.query(
      'SELECT profile_photo_public_id FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    const previousPublicId = existingUsers[0]?.profile_photo_public_id;

    await db.query(
      'UPDATE users SET profile_photo = NULL, profile_photo_url = NULL, profile_photo_public_id = NULL, profile_image = NULL WHERE id = ?',
      [userId]
    );

    if (previousPublicId) {
      await deleteImageByPublicId(previousPublicId);
    }

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

// Submit verification request (service provider)
exports.submitVerificationRequest = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const [users] = await db.query(
      'SELECT id, user_type FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (users[0].user_type !== 'tradesperson') {
      return res.status(403).json({
        success: false,
        message: 'Only service providers can request verification'
      });
    }

    const {
      fullName,
      phoneNumber,
      address,
      serviceDescription,
    } = req.body;

    const governmentIdFile = req.files?.governmentId?.[0];
    const certificationsFile = req.files?.certifications?.[0];

    if (!fullName || !phoneNumber || !address || !serviceDescription || !governmentIdFile || !certificationsFile) {
      return res.status(400).json({
        success: false,
        message: 'All fields and required documents must be provided'
      });
    }

    // Keep only one active pending request per user
    const [pendingRequests] = await db.query(
      'SELECT id FROM verification_requests WHERE user_id = ? AND status = "pending" LIMIT 1',
      [userId]
    );

    if (pendingRequests.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending verification request'
      });
    }

    await db.query(
      `INSERT INTO verification_requests
       (user_id, full_name, phone_number, address, service_description, government_id_data, government_id_mime, certifications_data, certifications_mime, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        userId,
        fullName,
        phoneNumber,
        address,
        serviceDescription,
        governmentIdFile.buffer,
        governmentIdFile.mimetype || 'application/octet-stream',
        certificationsFile.buffer,
        certificationsFile.mimetype || 'application/octet-stream'
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Verification request submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting verification request:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting verification request'
    });
  }
};
