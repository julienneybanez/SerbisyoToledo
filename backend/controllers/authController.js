const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const db = require('../config/database');
const {
  generateVerificationToken,
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require('../utils/emailService');

const RESET_TOKEN_EXPIRY_MINUTES = Number(process.env.PASSWORD_RESET_TOKEN_EXP_MINUTES || 20);

const resolveUserProfileImage = (user) => {
  if (user.profile_photo_url) {
    return user.profile_photo_url;
  }

  if (user.profile_image) {
    return user.profile_image;
  }

  if (user.profile_photo) {
    return `data:image/jpeg;base64,${user.profile_photo.toString('base64')}`;
  }

  return null;
};

// Generate JWT token
const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';

  if (!process.env.JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET is not set. Falling back to a development secret.');
  }

  return jwt.sign(
    { userId },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Register a new user
exports.register = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { fullName, email, password, userType, preferredServices, profession, skills } = req.body;

    if (!['client', 'tradesperson'].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: 'Public registration is only available for clients and service providers'
      });
    }

    // Check if user already exists
    const [existingUsers] = await db.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Prepare user data
    const userData = {
      full_name: fullName,
      email,
      password: hashedPassword,
      user_type: userType,
      preferred_services: userType === 'client' ? preferredServices : null,
      profession: userType === 'tradesperson' ? profession : null,
      skills: userType === 'tradesperson' && skills ? JSON.stringify(skills) : null
    };

    // Email verification is temporarily disabled in production, so new accounts are activated immediately.
    const [result] = await db.query(
      `INSERT INTO users (full_name, email, password, user_type, preferred_services, profession, skills, email_verified, verification_token, verification_token_expires) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userData.full_name,
        userData.email,
        userData.password,
        userData.user_type,
        userData.preferred_services,
        userData.profession,
        userData.skills,
        true,
        null,
        null
      ]
    );

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Registration successful! You can now use your account.',
      data: {
        user: {
          id: result.insertId,
          fullName: userData.full_name,
          email: userData.email,
          userType: userData.user_type,
          preferredServices: userData.preferred_services,
          profession: userData.profession,
          skills: skills || [],
          emailVerified: true
        }
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Forgot password - always return a generic message
exports.forgotPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email } = req.body;
    const genericMessage = 'If this email is registered, a password reset link has been sent.';

    const [users] = await db.query(
      'SELECT id, full_name, email FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.json({
        success: true,
        message: genericMessage
      });
    }

    const user = users[0];
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await db.query('DELETE FROM password_reset_tokens WHERE user_id = ?', [user.id]);

    await db.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, tokenHash, expiresAt]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password/${rawToken}`;

    const emailResult = await sendPasswordResetEmail(
      user.email,
      user.full_name,
      resetUrl,
      RESET_TOKEN_EXPIRY_MINUTES
    );

    if (!emailResult.success) {
      console.error('Password reset email failed:', emailResult.error);
      await db.query('DELETE FROM password_reset_tokens WHERE user_id = ?', [user.id]);
    }

    return res.json({
      success: true,
      message: genericMessage
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to process forgot password request. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Reset password using one-time token
exports.resetPassword = async (req, res) => {
  let connection;

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Reset token is required'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [tokens] = await db.query(
      `SELECT id, user_id, expires_at
       FROM password_reset_tokens
       WHERE token_hash = ? AND used_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [tokenHash]
    );

    if (tokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    const resetToken = tokens[0];
    const now = new Date();
    const tokenExpiry = new Date(resetToken.expires_at);

    if (now > tokenExpiry) {
      await db.query('DELETE FROM password_reset_tokens WHERE id = ?', [resetToken.id]);
      return res.status(400).json({
        success: false,
        message: 'Reset token has expired. Please request a new one.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    connection = await db.getConnection();
    await connection.beginTransaction();

    await connection.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, resetToken.user_id]
    );

    await connection.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?',
      [resetToken.id]
    );

    await connection.query(
      'DELETE FROM password_reset_tokens WHERE user_id = ? AND id <> ?',
      [resetToken.user_id, resetToken.id]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: 'Password reset successful. You can now log in with your new password.'
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password, loginAs } = req.body;

    // Find user by email
    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = users[0];

    // Check if account is active
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user type matches login attempt (optional validation)
    if (loginAs && user.user_type !== loginAs) {
      return res.status(401).json({
        success: false,
        message: `This account is registered as a ${user.user_type}, not as a ${loginAs}`
      });
    }

    // Generate token
    const token = generateToken(user.id);

    // Parse skills if JSON string
    let skills = [];
    if (user.skills) {
      try {
        skills = typeof user.skills === 'string' ? JSON.parse(user.skills) : user.skills;
      } catch (e) {
        skills = [];
      }
    }

    // Return success response
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          userType: user.user_type,
          preferredServices: user.preferred_services,
          profession: user.profession,
          skills,
          profileImage: resolveUserProfileImage(user),
          phone: user.phone,
          address: user.address,
          bio: user.bio,
          isVerified: user.is_verified
        },
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get current user profile
exports.getMe = async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT * FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Parse skills if JSON string
    let skills = [];
    if (user.skills) {
      try {
        skills = typeof user.skills === 'string' ? JSON.parse(user.skills) : user.skills;
      } catch (e) {
        skills = [];
      }
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          userType: user.user_type,
          preferredServices: user.preferred_services,
          profession: user.profession,
          skills,
          profileImage: resolveUserProfileImage(user),
          phone: user.phone,
          address: user.address,
          bio: user.bio,
          isVerified: user.is_verified,
          createdAt: user.created_at
        }
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Logout user
exports.logout = async (req, res) => {
  try {
    // In a more complete implementation, you would invalidate the token here
    // For now, we'll just return a success message
    // The frontend should remove the token from storage
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const { fullName, phone, address, bio, profession, skills } = req.body;
    const userId = req.user.userId;

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (fullName) {
      updates.push('full_name = ?');
      values.push(fullName);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }
    if (address !== undefined) {
      updates.push('address = ?');
      values.push(address);
    }
    if (bio !== undefined) {
      updates.push('bio = ?');
      values.push(bio);
    }
    if (profession !== undefined) {
      updates.push('profession = ?');
      values.push(profession);
    }
    if (skills !== undefined) {
      updates.push('skills = ?');
      values.push(JSON.stringify(skills));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(userId);

    await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch updated user
    const [users] = await db.query(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    const user = users[0];

    // Parse skills
    let parsedSkills = [];
    if (user.skills) {
      try {
        parsedSkills = typeof user.skills === 'string' ? JSON.parse(user.skills) : user.skills;
      } catch (e) {
        parsedSkills = [];
      }
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          userType: user.user_type,
          preferredServices: user.preferred_services,
          profession: user.profession,
          skills: parsedSkills,
          profileImage: resolveUserProfileImage(user),
          phone: user.phone,
          address: user.address,
          bio: user.bio,
          isVerified: user.is_verified
        }
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Verify email with token
exports.verifyEmail = async (req, res) => {
  try {
    let { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required'
      });
    }

    // Decode token if it's URL encoded
    try {
      token = decodeURIComponent(token);
    } catch (e) {
      // Token might not be encoded, continue
    }

    console.log('Token verification attempt - Token:', token.substring(0, 10) + '...');

    // Find user with this token
    const [users] = await db.query(
      'SELECT id, full_name, email, verification_token_expires FROM users WHERE verification_token = ?',
      [token]
    );

    console.log('Verification query result:', users.length, 'users found');

    if (users.length === 0) {
      console.log('Token not found in database');
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

    const user = users[0];

    // Check if token has expired
    const now = new Date();
    const expiryTime = new Date(user.verification_token_expires);
    
    console.log('Token expiry check - Now:', now.toISOString(), 'Expires:', expiryTime.toISOString());

    if (now > expiryTime) {
      console.log('Token has expired');
      return res.status(400).json({
        success: false,
        message: 'Verification token has expired. Please request a new one.'
      });
    }

    // Update user - mark email as verified and clear token
    await db.query(
      'UPDATE users SET email_verified = TRUE, verification_token = NULL, verification_token_expires = NULL WHERE id = ?',
      [user.id]
    );

    console.log('✅ Email verified successfully for user:', user.id, user.email);

    res.json({
      success: true,
      message: 'Email verified successfully! You can now log in.'
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Resend verification email
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Find user
    const [users] = await db.query(
      'SELECT id, full_name, email, email_verified FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email'
      });
    }

    const user = users[0];

    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Generate new token
    const verificationToken = generateVerificationToken();
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update token in database
    await db.query(
      'UPDATE users SET verification_token = ?, verification_token_expires = ? WHERE id = ?',
      [verificationToken, tokenExpires, user.id]
    );

    // Send email
    const emailResult = await sendVerificationEmail(user.email, user.full_name, verificationToken);

    if (emailResult.success) {
      res.json({
        success: true,
        message: 'Verification email sent! Please check your inbox.'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again.'
      });
    }

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend verification email',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
