const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.post('/', orderController.create);
router.get('/my', requireAuth, orderController.getMyOrders);
router.get('/:id', orderController.getOne);
router.patch('/:id/status', requireAuth, requireAdmin, orderController.updateStatus);

module.exports = router;
