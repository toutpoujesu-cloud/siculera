'use strict';

const express = require('express');
const router  = express.Router();

const { login, logout, me, changePassword } = require('../controllers/authController');
const { requireAdminAuth } = require('../middleware/auth');

// POST /api/auth/admin/login
router.post('/login', login);

// POST /api/auth/admin/logout  (requires valid token)
router.post('/logout', requireAdminAuth, logout);

// GET  /api/auth/admin/me
router.get('/me', requireAdminAuth, me);

// POST /api/auth/admin/change-password
router.post('/change-password', requireAdminAuth, changePassword);

module.exports = router;
