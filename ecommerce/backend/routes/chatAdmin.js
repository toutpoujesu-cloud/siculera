'use strict';

const express   = require('express');
const router    = express.Router();
const multer    = require('multer');
const path      = require('path');
const fs        = require('fs');
const ctrl      = require('../controllers/chatAdminController');

// ── Multer setup for knowledge base uploads ───────────────────────────────────

const uploadDir = path.join(process.cwd(), 'uploads', 'chat-docs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const safe = Date.now() + '-' + Math.random().toString(36).slice(2) + ext;
    cb(null, safe);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain'
  ];
  const allowedExt = ['.pdf', '.docx', '.doc', '.txt'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowed.includes(file.mimetype) || allowedExt.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOCX, DOC, and TXT files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

// ── Routes ────────────────────────────────────────────────────────────────────

// Config
router.get('/config',      ctrl.getConfig);
router.post('/config',     ctrl.saveConfig);

// Model list (used by admin UI dropdown)
router.get('/models',      ctrl.getModels);

// Knowledge base documents
router.get('/documents',              ctrl.getDocuments);
router.post('/documents', upload.single('file'), ctrl.uploadDocument);
router.patch('/documents/:id',        ctrl.updateDocument);
router.delete('/documents/:id',       ctrl.deleteDocument);

// Conversation history
router.get('/sessions',                       ctrl.getSessions);
router.get('/sessions/:id/messages',          ctrl.getSessionMessages);

// Analytics
router.get('/analytics',   ctrl.getAnalytics);

// Multer error handler
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
