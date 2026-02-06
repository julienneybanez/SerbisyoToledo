const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Validation rules for registration
const registerValidation = [
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 255 })
    .withMessage('Full name must be between 2 and 255 characters'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('userType')
    .isIn(['client', 'tradesperson', 'admin'])
    .withMessage('User type must be client, tradesperson, or admin'),
  body('preferredServices')
    .optional({ nullable: true })
    .trim(),
  body('profession')
    .optional({ nullable: true })
    .trim(),
  body('skills')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === undefined) return true;
      if (Array.isArray(value)) return true;
      throw new Error('Skills must be an array');
    })
];

// Validation rules for login
const loginValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Routes
// POST /api/auth/register - Register a new user
router.post('/register', registerValidation, authController.register);

// POST /api/auth/login - Login user
router.post('/login', loginValidation, authController.login);

// GET /api/auth/me - Get current user profile (protected)
router.get('/me', authenticateToken, authController.getMe);

// POST /api/auth/logout - Logout user
router.post('/logout', authenticateToken, authController.logout);

// PUT /api/auth/update-profile - Update user profile (protected)
router.put('/update-profile', authenticateToken, authController.updateProfile);

module.exports = router;
