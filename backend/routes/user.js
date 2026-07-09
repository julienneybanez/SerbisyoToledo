const express = require('express');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only image or PDF files are allowed'), false);
    }
  }
});

// All routes require authentication
router.use(authenticateToken);

// Get current user profile
router.get('/profile', userController.getProfile);

// Update user profile (with optional photo upload)
router.patch('/profile', upload.single('profilePhoto'), userController.updateProfile);

// Remove profile photo
router.delete('/profile/photo', userController.removeProfilePhoto);

// Submit verification request (service provider)
router.post(
  '/verification-request',
  upload.fields([
    { name: 'governmentId', maxCount: 1 },
    { name: 'certifications', maxCount: 1 },
  ]),
  userController.submitVerificationRequest
);

module.exports = router;
