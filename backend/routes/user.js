const express = require('express');
const multer = require('multer');
const { authenticateToken, requireUserType } = require('../middleware/auth');
const userController = require('../controllers/userController');
const { uploadLimiter } = require('../middleware/rateLimiters');
const { validateSingleUpload, validateMultiFieldUploads } = require('../middleware/uploadValidation');

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
router.patch('/profile', uploadLimiter, upload.single('profilePhoto'), validateSingleUpload({ allowedKinds: ['image'], required: false, fieldName: 'profilePhoto' }), userController.updateProfile);

// Remove profile photo
router.delete('/profile/photo', userController.removeProfilePhoto);

// Submit verification request (service provider)
router.post(
  '/verification-request',
  requireUserType('tradesperson'),
  uploadLimiter,
  upload.fields([
    { name: 'governmentId', maxCount: 1 },
    { name: 'certifications', maxCount: 1 },
  ]),
  validateMultiFieldUploads({
    governmentId: { allowedKinds: ['image', 'pdf'], required: true, maxCount: 1 },
    certifications: { allowedKinds: ['image', 'pdf'], required: true, maxCount: 1 },
  }),
  userController.submitVerificationRequest
);

module.exports = router;
