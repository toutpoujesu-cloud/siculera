const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Public: which payment methods are enabled + Stripe publishable key (safe to expose)
router.get('/config/public', paymentController.getPublicConfig);

// Stripe
router.post('/create-intent',    paymentController.createIntent);
router.post('/webhook',          paymentController.webhook);

// Public form submissions
router.post('/wholesale-enquiry', paymentController.wholesaleEnquiry);
router.post('/newsletter',        paymentController.newsletter);

module.exports = router;
