const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');

router.post('/register', userController.register);
router.post('/login', userController.login);
router.get('/me', requireAuth, userController.getMe);
router.patch('/me', requireAuth, userController.updateMe);

module.exports = router;
