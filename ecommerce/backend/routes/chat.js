'use strict';

const express        = require('express');
const router         = express.Router();
const chatController = require('../controllers/chatController');

/**
 * Public Chat Routes
 * Mounted at: /api/chat
 *
 * Rate limiting is applied at the server.js level via chatLimiter.
 */

// POST /api/chat/session — create or resume a session
router.post('/session', chatController.createSession);

// POST /api/chat/message — send a message (main chat endpoint)
router.post('/message', chatController.sendMessage);

// POST /api/chat/stream — streaming variant (Server-Sent Events)
router.post('/stream', chatController.streamMessage);

// POST /api/chat/consent — update GDPR consent
router.post('/consent', chatController.updateConsent);

// POST /api/chat/escalate — direct escalation to human agent
router.post('/escalate', chatController.escalate);

// POST /api/chat/order — direct checkout order submission (no AI loop)
router.post('/order', chatController.submitOrder);

// Payment provider routes
router.get( '/payment/config',           chatController.paymentConfig);
router.post('/payment/stripe/intent',    chatController.stripeCreateIntent);
router.post('/payment/stripe/confirm',   chatController.stripeConfirm);
router.post('/payment/paypal/order',     chatController.paypalCreateOrder);
router.post('/payment/paypal/capture',   chatController.paypalCapture);

module.exports = router;
