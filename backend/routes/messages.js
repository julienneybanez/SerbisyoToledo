const express = require('express');
const { authenticateToken, requireUserType } = require('../middleware/auth');
const messageController = require('../controllers/messageController');

const router = express.Router();

router.use(authenticateToken);
router.use(requireUserType('client', 'tradesperson'));

router.get('/', messageController.listConversations);
router.get('/unread-count', messageController.getUnreadCount);
router.post('/request/:requestId/open', messageController.openRequestConversation);
router.get('/:conversationId/messages', messageController.getConversationMessages);
router.post('/:conversationId/messages', messageController.sendMessage);
router.patch('/:conversationId/read', messageController.markConversationRead);

module.exports = router;
