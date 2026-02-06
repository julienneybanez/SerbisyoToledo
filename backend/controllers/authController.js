const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const db = require('../config/database');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
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

    // Insert user into database
    const [result] = await db.query(
      `INSERT INTO users (full_name, email, password, user_type, preferred_services, profession, skills) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userData.full_name,
        userData.email,
        userData.password,
        userData.user_type,
        userData.preferred_services,
        userData.profession,
        userData.skills
      ]
    );

    // Generate token
    const token = generateToken(result.insertId);

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: result.insertId,
          fullName: userData.full_name,
          email: userData.email,
          userType: userData.user_type,
          preferredServices: userData.preferred_services,
          profession: userData.profession,
          skills: skills || []
        },
        token
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
          profileImage: user.profile_image,
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
          profileImage: user.profile_image,
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
          profileImage: user.profile_image,
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
