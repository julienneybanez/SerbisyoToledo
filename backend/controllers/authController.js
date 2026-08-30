const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const db = require('../config/database');
const {
  boolFromEnv,
  generateVerificationToken,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
} = require('../utils/emailService');
const { getJwtSecret, getJwtSignOptions } = require('../utils/jwt');
const { setSessionCookies, clearSessionCookies } = require('../utils/sessionCookies');
const { normalizePhilippinePhone } = require('../utils/phone');
const {
  TERMS_VERSION,
  PRIVACY_NOTICE_VERSION,
  LEGAL_ACCEPTANCE_TYPES,
  LEGAL_CONTEXTS,
} = require('../constants/legalDocuments');

const RESET_TOKEN_EXPIRY_MINUTES = Number(process.env.PASSWORD_RESET_TOKEN_EXP_MINUTES || 20);
const PUBLIC_EMAIL_VERIFICATION_REQUIRED = true;
const WELCOME_EMAIL_ENABLED = boolFromEnv(process.env.WELCOME_EMAIL_ENABLED, false);
const VERIFICATION_TOKEN_EXPIRY_HOURS = Number(process.env.EMAIL_VERIFICATION_TOKEN_EXP_HOURS || 24);
const RESEND_VERIFICATION_MIN_INTERVAL_SECONDS = Number(process.env.RESEND_VERIFICATION_MIN_INTERVAL_SECONDS || 60);
const resendVerificationThrottle = new Map();
const SUPPORTED_LANGUAGE_CODES = new Set(['ceb', 'en', 'fil']);

const hashToken = (value) => crypto.createHash('sha256').update(value).digest('hex');

const fetchUserSkills = async (userId) => {
  const [rows] = await db.query(
    'SELECT skill_label FROM provider_skills WHERE user_id = ? ORDER BY skill_label',
    [userId]
  );
  return rows.map((row) => row.skill_label);
};

const isUrlLikeImageValue = (value) => {
  if (!value) {
    return false;
  }

  const normalized = String(value).trim();
  return /^(https?:\/\/|data:image\/)/i.test(normalized);
};

const shouldThrottleResend = (email) => {
  const key = String(email || '').toLowerCase();
  const now = Date.now();
  const last = resendVerificationThrottle.get(key);

  if (last && now - last < RESEND_VERIFICATION_MIN_INTERVAL_SECONDS * 1000) {
    return true;
  }

  resendVerificationThrottle.set(key, now);
  return false;
};

const resolveUserProfileImage = (user) => {
  if (isUrlLikeImageValue(user.profile_photo_url)) {
    return user.profile_photo_url;
  }

  if (isUrlLikeImageValue(user.profile_image)) {
    return user.profile_image;
  }

  if (user.profile_photo) {
    return `data:image/jpeg;base64,${user.profile_photo.toString('base64')}`;
  }

  return null;
};

// Generate JWT token
const generateToken = (userId) => {
  const secret = getJwtSecret();

  if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'production') {
    console.warn('⚠️  JWT_SECRET is not set. Falling back to a development secret.');
  }

  return jwt.sign(
    { userId },
    secret,
    getJwtSignOptions()
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

    const { fullName, email, password, userType, profession, skills, languages, acceptedTerms, acknowledgedPrivacy } = req.body;

    if (acceptedTerms !== true) {
      return res.status(400).json({
        success: false,
        code: 'TERMS_ACCEPTANCE_REQUIRED',
        message: 'You must agree to the Terms and Conditions to register.'
      });
    }

    if (acknowledgedPrivacy !== true) {
      return res.status(400).json({
        success: false,
        code: 'PRIVACY_ACKNOWLEDGEMENT_REQUIRED',
        message: 'You must acknowledge the Privacy Notice to register.'
      });
    }

    const normalizedLanguages = userType === 'tradesperson'
      ? Array.from(
        new Set(
          (Array.isArray(languages) ? languages : [])
            .map((value) => String(value || '').trim().toLowerCase())
            .filter(Boolean)
        )
      )
      : [];

    if (normalizedLanguages.some((code) => !SUPPORTED_LANGUAGE_CODES.has(code))) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported language code provided'
      });
    }

    const normalizedSkills = userType === 'tradesperson'
      ? Array.from(new Set((Array.isArray(skills) ? skills : []).map((s) => String(s || '').trim()).filter(Boolean)))
      : [];

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
      profession: userType === 'tradesperson' ? profession : null,
    };

    const isEmailVerified = false;
    const verificationTokenRaw = generateVerificationToken();
    const verificationTokenHash = verificationTokenRaw ? hashToken(verificationTokenRaw) : null;
    const verificationTokenExpires = verificationTokenRaw
      ? new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)
      : null;

    const connection = await db.getConnection();
    let insertId;
    try {
      await connection.beginTransaction();

      // Insert user into database
      const [result] = await connection.query(
        `INSERT INTO users (full_name, email, password, user_type, profession, email_verified, verification_token, verification_token_expires)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userData.full_name,
          userData.email,
          userData.password,
          userData.user_type,
          userData.profession,
          isEmailVerified,
          verificationTokenHash,
          verificationTokenExpires
        ]
      );

      insertId = result.insertId;

      for (const languageCode of normalizedLanguages) {
        await connection.query(
          'INSERT INTO person_languages (user_id, language_code) VALUES (?, ?)',
          [insertId, languageCode]
        );
      }

      for (const skillLabel of normalizedSkills) {
        await connection.query(
          'INSERT INTO provider_skills (user_id, skill_label) VALUES (?, ?)',
          [insertId, skillLabel]
        );
      }

      await connection.query(
        `INSERT INTO legal_acceptances (user_id, acceptance_type, document_version, context)
         VALUES (?, ?, ?, ?)`,
        [insertId, LEGAL_ACCEPTANCE_TYPES.TERMS, TERMS_VERSION, LEGAL_CONTEXTS.REGISTRATION]
      );
      await connection.query(
        `INSERT INTO legal_acceptances (user_id, acceptance_type, document_version, context)
         VALUES (?, ?, ?, ?)`,
        [insertId, LEGAL_ACCEPTANCE_TYPES.PRIVACY_NOTICE, PRIVACY_NOTICE_VERSION, LEGAL_CONTEXTS.REGISTRATION]
      );

      await connection.commit();
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }

    const verificationEmailResult = await sendVerificationEmail(
      userData.email,
      userData.full_name,
      verificationTokenRaw
    );

    if (!verificationEmailResult.success) {
      console.error('Verification email was not sent:', verificationEmailResult.errorCode || verificationEmailResult.error);
    }

    let welcomeEmailResult = { success: true };
    if (WELCOME_EMAIL_ENABLED) {
      welcomeEmailResult = await sendWelcomeEmail(
        userData.email,
        userData.full_name,
        userData.user_type
      );

      if (!welcomeEmailResult.success) {
        console.error('Welcome email was not sent:', welcomeEmailResult.errorCode || welcomeEmailResult.error);
      }
    }

    const token = null;

    // Return success response
    res.status(201).json({
      success: true,
      message: verificationEmailResult.success
        ? 'Registration successful! Please check your email to verify your account before logging in.'
        : 'Registration successful, but the verification email could not be sent. Please use Resend Verification Email before logging in.',
      data: {
        user: {
          id: insertId,
          fullName: userData.full_name,
          email: userData.email,
          userType: userData.user_type,
          profession: userData.profession,
          skills: normalizedSkills,
          emailVerified: isEmailVerified
        },
        verificationRequired: PUBLIC_EMAIL_VERIFICATION_REQUIRED,
        verificationEmailSent: Boolean(verificationEmailResult.success),
        ...(token ? { token } : {})
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

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is active only after password validation succeeds
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_DISABLED',
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    if (PUBLIC_EMAIL_VERIFICATION_REQUIRED && user.user_type !== 'admin' && !user.email_verified) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email address before logging in.',
      });
    }

    // Check if user type matches login attempt (optional validation)
    if (loginAs && user.user_type !== loginAs) {
      return res.status(401).json({
        success: false,
        message: `This account is registered as a ${user.user_type}, not as a ${loginAs}`
      });
    }

    // Issue the JWT only through an HttpOnly cookie. The token is intentionally
    // not returned to browser JavaScript.
    const token = generateToken(user.id);
    setSessionCookies(res, token);

    await db.query(
      'UPDATE users SET is_online = TRUE, last_seen_at = NOW() WHERE id = ?',
      [user.id]
    );

    const skills = await fetchUserSkills(user.id);

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
          profession: user.profession,
          skills,
          profileImage: resolveUserProfileImage(user),
          phone: user.phone,
          address: user.address,
          bio: user.bio,
          isVerified: user.is_verified,
          emailVerified: Boolean(user.email_verified),
        }
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

    const skills = await fetchUserSkills(user.id);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          userType: user.user_type,
          profession: user.profession,
          skills,
          profileImage: resolveUserProfileImage(user),
          phone: user.phone,
          address: user.address,
          bio: user.bio,
          isVerified: user.is_verified,
          emailVerified: Boolean(user.email_verified),
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
    const userId = req.user?.userId;

    if (userId) {
      await db.query(
        'UPDATE users SET is_online = FALSE, last_seen_at = NOW() WHERE id = ?',
        [userId]
      );
    }

    clearSessionCookies(res);
    
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

// Issue short-lived socket ticket for realtime socket connection
exports.getSocketTicket = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const ticket = jwt.sign(
      { userId, scope: 'socket' },
      getJwtSecret(),
      { expiresIn: '60s' }
    );

    return res.json({
      success: true,
      data: { ticket }
    });
  } catch (error) {
    console.error('Socket ticket error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate socket ticket'
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
      const normalizedPhone = normalizePhilippinePhone(phone);
      if (normalizedPhone === undefined) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PHONE',
          message: 'Enter a valid Philippine mobile number (09XXXXXXXXX or +639XXXXXXXXX).'
        });
      }
      updates.push('phone = ?');
      values.push(normalizedPhone);
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

    if (updates.length === 0 && skills === undefined) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    if (updates.length > 0) {
      values.push(userId);
      await db.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    if (skills !== undefined) {
      const normalizedSkills = Array.from(new Set((Array.isArray(skills) ? skills : []).map((s) => String(s || '').trim()).filter(Boolean)));
      await db.query('DELETE FROM provider_skills WHERE user_id = ?', [userId]);
      for (const skillLabel of normalizedSkills) {
        await db.query('INSERT INTO provider_skills (user_id, skill_label) VALUES (?, ?)', [userId, skillLabel]);
      }
    }

    // Fetch updated user
    const [users] = await db.query(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    const user = users[0];

    const parsedSkills = await fetchUserSkills(userId);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          userType: user.user_type,
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
    } catch {
      // Token might not be encoded, continue
    }

    const tokenHash = hashToken(token);

    // Find user with this token
    const [users] = await db.query(
      'SELECT id, full_name, email, verification_token_expires FROM users WHERE verification_token = ?',
      [tokenHash]
    );

    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

    const user = users[0];

    // Check if token has expired
    const now = new Date();
    const expiryTime = new Date(user.verification_token_expires);

    if (now > expiryTime) {
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

    if (shouldThrottleResend(email)) {
      return res.status(429).json({
        success: false,
        message: `Please wait ${RESEND_VERIFICATION_MIN_INTERVAL_SECONDS} seconds before requesting another verification email.`
      });
    }

    // Find user
    const [users] = await db.query(
      'SELECT id, full_name, email, email_verified FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.json({
        success: true,
        message: 'If this account exists and is unverified, a verification email has been sent.'
      });
    }

    const user = users[0];

    if (user.email_verified) {
      return res.json({
        success: true,
        message: 'Email is already verified.'
      });
    }

    // Generate new token
    const verificationToken = generateVerificationToken();
    const verificationTokenHash = hashToken(verificationToken);
    const tokenExpires = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Update token in database
    await db.query(
      'UPDATE users SET verification_token = ?, verification_token_expires = ? WHERE id = ?',
      [verificationTokenHash, tokenExpires, user.id]
    );

    // Send email
    const emailResult = await sendVerificationEmail(user.email, user.full_name, verificationToken);

    if (emailResult.success) {
      res.json({
        success: true,
        message: 'Verification email sent! Please check your inbox.'
      });
    } else {
      res.status(503).json({
        success: false,
        message: 'Unable to send verification email right now. Please try again later.'
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
