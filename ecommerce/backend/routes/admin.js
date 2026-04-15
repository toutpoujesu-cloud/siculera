'use strict';

const path    = require('path');
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/adminController');
const { requireAdminAuth } = require('../middleware/auth');

/* ── Multer for product image uploads ──────────────────────────────────── */
let upload;
try {
  const multer = require('multer');
  const storage = multer.diskStorage({
    destination: path.join(__dirname, '../../uploads/products'),
    filename: (req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase() || '.jpg';
      const name = `product-${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
      cb(null, name);
    }
  });
  upload = multer({
    storage,
    limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB
    fileFilter: (req, file, cb) => {
      if (/^image\/(jpeg|jpg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
      else cb(new Error('Only image files (jpeg, png, webp, gif) are allowed'));
    }
  });
} catch (_) {
  // multer not installed yet — upload routes will return 503
  upload = { single: () => (req, res, next) => res.status(503).json({ error: 'Run npm install to enable uploads' }) };
}

// All admin routes require authentication.
// The server mounts this router behind requireAdminAuth already,
// but we apply it here as well for defence-in-depth.
router.use(requireAdminAuth);

/* ── Stats ───────────────────────────────────────────────────────────────── */
router.get('/stats', ctrl.getStats);

/* ── Products ────────────────────────────────────────────────────────────── */
router.get   ('/products',                ctrl.listProducts);
router.post  ('/products',                ctrl.createProduct);
router.get   ('/products/:id',            ctrl.getProduct);
router.put   ('/products/:id',            ctrl.updateProduct);
router.delete('/products/:id',            ctrl.deleteProduct);

// Image upload: POST /api/admin/products/:id/image  (multipart/form-data, field: image)
router.post('/products/:id/image', upload.single('image'), ctrl.uploadProductImage);

/* ── Customers ───────────────────────────────────────────────────────────── */
router.get   ('/customers',             ctrl.listCustomers);
router.get   ('/customers/:id',         ctrl.getCustomer);
router.delete('/customers/:id/erase',   ctrl.eraseCustomer);
router.get   ('/customers/:id/export',  ctrl.exportCustomerData);

/* ── Orders ──────────────────────────────────────────────────────────────── */
router.get('/orders',              ctrl.listOrders);
router.get('/orders/:id',          ctrl.getOrder);
router.put('/orders/:id/status',   ctrl.updateOrderStatus);
router.put('/orders/:id/tracking', ctrl.updateOrderTracking);

/* ── Payment configuration ───────────────────────────────────────────────── */
router.get ('/payment-config',              ctrl.listPaymentConfig);
router.post('/payment-config',              ctrl.savePaymentConfig);
router.post('/payment-config/test/:provider', ctrl.testPaymentProvider);

/* ── Payment history ─────────────────────────────────────────────────────── */
router.get('/payments/history', ctrl.listPaymentHistory);

/* ── Shipping configuration ──────────────────────────────────────────────── */
router.get ('/shipping-config', ctrl.getShippingConfig);
router.post('/shipping-config', ctrl.saveShippingConfig);

/* ── Shipping tracking ───────────────────────────────────────────────────── */
router.get('/shipping/track', ctrl.trackShipment);

/* ── Security / GDPR ─────────────────────────────────────────────────────── */
router.get ('/security-config', ctrl.getSecurityConfig);
router.post('/security-config', ctrl.saveSecurityConfig);
router.get ('/audit-log',       ctrl.getAuditLog);

/* ── General settings ────────────────────────────────────────────────────── */
router.get ('/settings', ctrl.getSettings);
router.post('/settings', ctrl.saveSettings);

module.exports = router;
