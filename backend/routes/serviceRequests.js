const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  createRequest,
  getClientRequests,
  getProviderRequests,
  updateRequestStatus,
  requestDiscussion,
  acceptDiscussion,
  getRequestById,
  createReview,
  createReport
} = require('../controllers/serviceRequestController');

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

// All routes require authentication
router.use(authenticateToken);

// Create a new service request (client)
router.post('/create', createRequest);

// Get requests for client (sent requests)
router.get('/client', getClientRequests);

// Get requests for provider (received requests)
router.get('/provider', getProviderRequests);

// Get single request by ID
router.get('/:requestId', getRequestById);

// Update request status (accept/decline/on_the_way/complete)
router.patch('/:requestId/status', updateRequestStatus);

// Request discussion (client)
router.post('/:requestId/request-discussion', requestDiscussion);

// Accept discussion (provider)
router.post('/:requestId/accept-discussion', acceptDiscussion);

// Create a review for a completed request (client)
router.post('/:requestId/review', createReview);

// Report the other party in a request (requires existing request interaction)
router.post('/:requestId/report', upload.single('screenshot'), createReport);

module.exports = router;
