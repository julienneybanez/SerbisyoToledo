const express = require('express');
const multer = require('multer');
const { authenticateToken, requireUserType } = require('../middleware/auth');
const { validateSingleUpload } = require('../middleware/uploadValidation');
const serviceProfileController = require('../controllers/serviceProfileController');

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

const credentialUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only image or PDF files are allowed'), false);
    }
  }
});

// Public routes
router.get('/all', serviceProfileController.getAllProfiles);
router.get('/recommendations', serviceProfileController.getRecommendedProviders);
router.get('/:id/available-dates', serviceProfileController.getAvailableDates);
router.get('/:id/available-slots', serviceProfileController.getAvailableSlots);

// Protected routes (requires authentication)
router.post('/create', authenticateToken, requireUserType('tradesperson'), upload.single('bannerImage'), validateSingleUpload({ allowedKinds: ['image'], required: false, fieldName: 'bannerImage' }), serviceProfileController.createOrUpdateProfile);
router.get('/user/me', authenticateToken, requireUserType('tradesperson'), serviceProfileController.getMyProfile);
router.patch('/toggle-publish', authenticateToken, requireUserType('tradesperson'), serviceProfileController.togglePublish);

// Provider availability routes
router.get('/availability/me', authenticateToken, requireUserType('tradesperson'), serviceProfileController.getMyAvailability);
router.put('/availability/me', authenticateToken, requireUserType('tradesperson'), serviceProfileController.saveMyAvailability);
router.post('/availability/me/exceptions', authenticateToken, requireUserType('tradesperson'), serviceProfileController.addAvailabilityException);
router.delete('/availability/me/exceptions/:exceptionId', authenticateToken, requireUserType('tradesperson'), serviceProfileController.deleteAvailabilityException);

// Provider languages
router.get('/languages/me', authenticateToken, requireUserType('tradesperson'), serviceProfileController.getMyLanguages);
router.put('/languages/me', authenticateToken, requireUserType('tradesperson'), serviceProfileController.updateMyLanguages);

// Provider credentials
router.get('/credentials/me', authenticateToken, requireUserType('tradesperson'), serviceProfileController.getMyCredentials);
router.post('/credentials/me', authenticateToken, requireUserType('tradesperson'), credentialUpload.single('document'), validateSingleUpload({ allowedKinds: ['image', 'pdf'], required: false, fieldName: 'document' }), serviceProfileController.createCredential);
router.post('/credentials/me/:credentialId/submit', authenticateToken, requireUserType('tradesperson'), serviceProfileController.submitCredentialForReview);

// Portfolio management routes
router.get('/portfolio/me', authenticateToken, requireUserType('tradesperson'), serviceProfileController.getMyPortfolio);
router.patch('/portfolio/details', authenticateToken, requireUserType('tradesperson'), serviceProfileController.updatePortfolioDetails);
router.post('/portfolio/image', authenticateToken, requireUserType('tradesperson'), upload.single('portfolioImage'), validateSingleUpload({ allowedKinds: ['image'], required: true, fieldName: 'portfolioImage' }), serviceProfileController.addPortfolioImage);
router.delete('/portfolio/image/:imageId', authenticateToken, requireUserType('tradesperson'), serviceProfileController.deletePortfolioImage);
router.get('/portfolio/completed-requests', authenticateToken, requireUserType('tradesperson'), serviceProfileController.listEligibleCompletedRequests);
router.post('/portfolio/from-request', authenticateToken, requireUserType('tradesperson'), serviceProfileController.createPortfolioFromCompletedRequest);

// Public route with dynamic param (must come last)
router.get('/:id', serviceProfileController.getProfileById);

module.exports = router;
