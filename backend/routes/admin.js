const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/dashboard-stats - Get dashboard statistics
router.get('/dashboard-stats', adminController.getDashboardStats);

// GET /api/admin/users - Get all users
router.get('/users', adminController.getAllUsers);

// GET /api/admin/users/:id - Get user by ID
router.get('/users/:id', adminController.getUserById);

// PUT /api/admin/users/:id/status - Update user status
router.put('/users/:id/status', adminController.updateUserStatus);

// GET /api/admin/users/:id/activity - Get user activity summary
router.get('/users/:id/activity', adminController.getUserActivity);

// GET /api/admin/verification-requests - Get verification requests
router.get('/verification-requests', adminController.getVerificationRequests);

// PATCH /api/admin/verification-requests/:id - Approve/reject verification request
router.patch('/verification-requests/:id', adminController.reviewVerificationRequest);

// GET /api/admin/reports - Get reports
router.get('/reports', adminController.getReports);

// PATCH /api/admin/reports/:id - Update report moderation status
router.patch('/reports/:id', adminController.updateReportStatus);

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', adminController.deleteUser);

module.exports = router;
