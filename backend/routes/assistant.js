const express = require('express');
const assistantController = require('../controllers/assistantController');
const { assistantLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.get('/capabilities', assistantController.getCapabilities);
router.post('/message', assistantLimiter, assistantController.sendMessage);

module.exports = router;
