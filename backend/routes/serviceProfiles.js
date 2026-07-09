const express = require('express');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
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

// Public routes
router.get('/all', serviceProfileController.getAllProfiles);

// Protected routes (requires authentication)
router.post('/create', authenticateToken, upload.single('bannerImage'), serviceProfileController.createOrUpdateProfile);
router.get('/user/me', authenticateToken, serviceProfileController.getMyProfile);
router.patch('/toggle-publish', authenticateToken, serviceProfileController.togglePublish);

// Portfolio management routes
router.get('/portfolio/me', authenticateToken, serviceProfileController.getMyPortfolio);
router.patch('/portfolio/details', authenticateToken, serviceProfileController.updatePortfolioDetails);
router.post('/portfolio/image', authenticateToken, upload.single('portfolioImage'), serviceProfileController.addPortfolioImage);
router.delete('/portfolio/image/:imageId', authenticateToken, serviceProfileController.deletePortfolioImage);

// Public route with dynamic param (must come last)
router.get('/:id', serviceProfileController.getProfileById);

module.exports = router;
