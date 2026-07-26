const express = require('express');
const multer = require('multer');
const { authenticateToken, requireUserType } = require('../middleware/auth');
const serviceProfileController = require('../controllers/serviceProfileController');
const { uploadLimiter, publicSearchLimiter } = require('../middleware/rateLimiters');
const { validateSingleUpload } = require('../middleware/uploadValidation');

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Public routes
router.get('/all', publicSearchLimiter, serviceProfileController.getAllProfiles);

// Protected routes (requires authentication)
router.post('/create', authenticateToken, requireUserType('tradesperson'), uploadLimiter, upload.single('bannerImage'), validateSingleUpload({ allowedKinds: ['image'], required: false, fieldName: 'bannerImage' }), serviceProfileController.createOrUpdateProfile);
router.get('/user/me', authenticateToken, requireUserType('tradesperson'), serviceProfileController.getMyProfile);
router.patch('/toggle-publish', authenticateToken, requireUserType('tradesperson'), serviceProfileController.togglePublish);

// Portfolio management routes
router.get('/portfolio/me', authenticateToken, requireUserType('tradesperson'), serviceProfileController.getMyPortfolio);
router.patch('/portfolio/details', authenticateToken, requireUserType('tradesperson'), serviceProfileController.updatePortfolioDetails);
router.post('/portfolio/image', authenticateToken, requireUserType('tradesperson'), uploadLimiter, upload.single('portfolioImage'), validateSingleUpload({ allowedKinds: ['image'], required: true, fieldName: 'portfolioImage' }), serviceProfileController.addPortfolioImage);
router.delete('/portfolio/image/:imageId', authenticateToken, requireUserType('tradesperson'), serviceProfileController.deletePortfolioImage);

// Public route with dynamic param (must come last)
router.get('/:id', serviceProfileController.getProfileById);

module.exports = router;
