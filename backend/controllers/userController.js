const db = require('../config/database');
const {
  hasCloudinaryConfig,
  uploadImageBuffer,
  deleteImageByPublicId,
} = require('../utils/cloudinaryService');
const { normalizePhilippinePhone } = require('../utils/phone');
const {
  VERIFICATION_CONSENT_VERSION,
  LEGAL_ACCEPTANCE_TYPES,
  LEGAL_CONTEXTS,
} = require('../constants/legalDocuments');

const isUrlLikeImageValue = (value) => {
  if (!value) {
    return false;
  }

  return /^(https?:\/\/|data:image\/)/i.test(String(value).trim());
};

const formatProfilePhoto = (user) => {
  if (isUrlLikeImageValue(user.profile_photo_url)) {
    return user.profile_photo_url;
  }

  if (isUrlLikeImageValue(user.profile_image)) {
    return user.profile_image;
  }

  return null;
};

exports.updatePresence = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const online = req.body?.online !== false;

    await db.query(
      'UPDATE users SET is_online = ?, last_seen_at = NOW() WHERE id = ?',
      [online, userId]
    );

    return res.json({
      success: true,
      message: 'Presence updated'
    });
  } catch (error) {
    console.error('Error updating presence:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update presence'
    });
  }
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
      `SELECT id, full_name, email, email_verified, user_type, phone, address, bio, profile_photo_url, profile_image, created_at
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
        emailVerified: Boolean(user.email_verified),
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

// Get user onboarding progress
exports.getOnboardingProgress = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const [users] = await db.query(
      `SELECT id, user_type, email_verified, phone, address, is_verified FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = users[0];
    let tasks = [];

    if (user.user_type === 'client') {
      const [requests] = await db.query(
        `SELECT COUNT(*) AS count FROM service_requests WHERE client_id = ?`,
        [userId]
      );
      const hasRequest = requests[0].count > 0;
      const hasPhoneAddress = Boolean(user.phone && String(user.phone).trim() && user.address && String(user.address).trim());

      tasks = [
        {
          id: 'email_verified',
          titleKey: 'checklistVerifyEmail',
          defaultTitle: 'Verify your email address',
          completed: Boolean(user.email_verified),
          actionPath: '/client-settings',
        },
        {
          id: 'profile_info',
          titleKey: 'checklistCompleteProfile',
          defaultTitle: 'Add contact phone and Toledo address',
          completed: hasPhoneAddress,
          actionPath: '/client-settings',
        },
        {
          id: 'first_request',
          titleKey: 'checklistFirstRequest',
          defaultTitle: 'Submit your first service request',
          completed: hasRequest,
          actionPath: '/feed',
        },
      ];
    } else {
      const [profiles] = await db.query(
        `SELECT COUNT(*) AS count FROM service_profiles WHERE user_id = ?`,
        [userId]
      );
      const [schedules] = await db.query(
        `SELECT COUNT(*) AS count FROM provider_availability_schedules WHERE user_id = ?`,
        [userId]
      );
      const [verifications] = await db.query(
        `SELECT COUNT(*) AS count FROM verification_requests WHERE user_id = ?`,
        [userId]
      );

      tasks = [
        {
          id: 'email_verified',
          titleKey: 'checklistVerifyEmail',
          defaultTitle: 'Verify your email address',
          completed: Boolean(user.email_verified),
          actionPath: '/provider-settings',
        },
        {
          id: 'service_profile',
          titleKey: 'checklistServiceProfile',
          defaultTitle: 'Set up service profile',
          completed: profiles[0].count > 0,
          actionPath: '/provider-settings',
        },
        {
          id: 'availability',
          titleKey: 'checklistAvailability',
          defaultTitle: 'Configure weekly availability',
          completed: schedules[0].count > 0,
          actionPath: '/provider-availability',
        },
        {
          id: 'verification',
          titleKey: 'checklistVerification',
          defaultTitle: 'Submit verification documents',
          completed: Boolean(user.is_verified) || verifications[0].count > 0,
          actionPath: '/provider-credentials',
        },
      ];
    }

    const completedCount = tasks.filter((t) => t.completed).length;
    const totalCount = tasks.length;
    const isComplete = completedCount === totalCount;
    const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;

    return res.json({
      success: true,
      data: {
        userType: user.user_type,
        isComplete,
        completedCount,
        totalCount,
        completionPercentage,
        tasks,
      },
    });
  } catch (error) {
    console.error('Error fetching onboarding progress:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch onboarding progress',
    });
  }
};

// Get the current provider verification state. The latest request remains visible
// after review so providers do not have to rely on an old notification to know
// why they were rejected or whether a request is still under review.
exports.getVerificationStatus = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const [users] = await db.query(
      'SELECT id, is_verified FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [requests] = await db.query(
      `SELECT id, status, rejection_reason, created_at, reviewed_at
       FROM verification_requests
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [userId]
    );

    const latest = requests[0] || null;
    const status = users[0].is_verified
      ? 'approved'
      : (latest?.status || 'not_submitted');

    return res.json({
      success: true,
      data: {
        status,
        isVerified: Boolean(users[0].is_verified),
        requestId: latest?.id || null,
        rejectionReason: status === 'rejected' ? (latest?.rejection_reason || null) : null,
        submittedAt: latest?.created_at || null,
        reviewedAt: latest?.reviewed_at || null,
        canResubmit: status === 'rejected' || status === 'not_submitted',
      },
    });
  } catch (error) {
    console.error('Error fetching verification status:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch verification status' });
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
    let profilePhotoUrl = null;
    let profilePhotoPublicId = null;

    const [existingUsers] = await db.query(
      'SELECT profile_photo_public_id FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    const previousPublicId = existingUsers[0]?.profile_photo_public_id;

    // Handle profile photo upload if provided. Never report a successful save
    // while silently discarding the selected image.
    if (req.file) {
      if (!hasCloudinaryConfig()) {
        return res.status(503).json({
          success: false,
          code: 'PROFILE_PHOTO_STORAGE_UNAVAILABLE',
          message: 'Profile photo storage is temporarily unavailable. Please try again later.'
        });
      }

      const uploadResult = await uploadImageBuffer({
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        folder: 'serbisyo-toledo/profile-photos',
      });

      profilePhotoUrl = uploadResult.secure_url;
      profilePhotoPublicId = uploadResult.public_id;
    }

    // Build dynamic update query
    const updates = [];
    const params = [];

    if (fullName) {
      updates.push('full_name = ?');
      params.push(fullName);
    }

    if (phone !== undefined) {
      const normalizedPhone = normalizePhilippinePhone(phone);
      if (normalizedPhone === undefined) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PHONE',
          message: 'Enter a valid Philippine mobile number (09XXXXXXXXX or +639XXXXXXXXX).'
        });
      }
      updates.push('phone = ?');
      params.push(normalizedPhone);
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
      // A newly uploaded Cloudinary image becomes the canonical account photo.
      // Clear legacy copies so later reads/removals cannot resurrect an old image.
      updates.push('profile_image = NULL');
      updates.push('profile_photo = NULL');
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
      `SELECT id, full_name, email, email_verified, user_type, phone, address, bio, profile_photo, profile_photo_url, profile_image
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
      'UPDATE users SET profile_photo_url = NULL, profile_photo_public_id = NULL, profile_image = NULL, profile_photo = NULL WHERE id = ?',
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
      verificationConsent,
    } = req.body;

    if (verificationConsent !== true && verificationConsent !== 'true') {
      return res.status(400).json({
        success: false,
        code: 'VERIFICATION_CONSENT_REQUIRED',
        message: 'You must consent to the collection and processing of your verification information, including your government ID.'
      });
    }

    const governmentIdFile = req.files?.governmentId?.[0];
    const certificationsFile = req.files?.certifications?.[0];

    const normalizedPhone = normalizePhilippinePhone(phoneNumber, { allowEmpty: false });
    if (!fullName || !normalizedPhone || !address || !serviceDescription || !governmentIdFile) {
      return res.status(400).json({
        success: false,
        message: 'Name, valid phone number, address, service description, and government ID are required.'
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

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [insertResult] = await connection.query(
        `INSERT INTO verification_requests
         (user_id, full_name, phone_number, address, service_description, government_id_data, government_id_mime, certifications_data, certifications_mime, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          userId,
          fullName,
          normalizedPhone,
          address,
          serviceDescription,
          governmentIdFile.buffer,
          governmentIdFile.mimetype || 'application/octet-stream',
          certificationsFile ? certificationsFile.buffer : null,
          certificationsFile ? (certificationsFile.mimetype || 'application/octet-stream') : null
        ]
      );

      await connection.query(
        `INSERT INTO legal_acceptances (user_id, acceptance_type, document_version, context, verification_request_id)
         VALUES (?, ?, ?, ?, ?)`,
        [
          userId,
          LEGAL_ACCEPTANCE_TYPES.VERIFICATION_DATA_CONSENT,
          VERIFICATION_CONSENT_VERSION,
          LEGAL_CONTEXTS.PROVIDER_VERIFICATION,
          insertResult.insertId,
        ]
      );

      await connection.commit();
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }

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
