const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/', productController.getAll);
router.get('/:idOrSlug', productController.getOne);
router.post('/', requireAuth, requireAdmin, productController.create);
router.patch('/:id', requireAuth, requireAdmin, productController.update);

module.exports = router;
