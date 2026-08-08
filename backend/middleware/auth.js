const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { getJwtSecret } = require('../utils/jwt');

// Middleware to authenticate JWT token
exports.authenticateToken = async (req, res, next) => {
  // Get token from header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, getJwtSecret());

    const [users] = await db.query(
      'SELECT id, user_type, is_active FROM users WHERE id = ? LIMIT 1',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_USER_NOT_FOUND',
        message: 'Invalid authentication token.'
      });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_DISABLED',
        message: 'This account is currently disabled.'
      });
    }

    req.user = {
      userId: user.id,
      userType: user.user_type,
      isActive: Boolean(user.is_active)
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Token has expired. Please login again.'
      });
    }
    
    return res.status(403).json({
      success: false,
      code: 'INVALID_TOKEN',
      message: 'Invalid token.'
    });
  }
};

// Optional: Middleware to check user type
exports.requireUserType = (...allowedTypes) => {
  return (req, res, next) => {
    if (!req.user || !req.user.userId || !req.user.userType) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Authentication required.'
      });
    }

    if (!req.user.isActive) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_DISABLED',
        message: 'This account is currently disabled.'
      });
    }

    if (!allowedTypes.includes(req.user.userType)) {
      return res.status(403).json({
        success: false,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

// Middleware to require admin access
exports.requireAdmin = exports.requireUserType('admin');
