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

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', adminController.deleteUser);

module.exports = router;
