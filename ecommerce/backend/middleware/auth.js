'use strict';

const jwt = require('jsonwebtoken');
const db  = require('../models/db');

/* ──────────────────────────────────────────────────────────────────────────
   requireAdminAuth
   ─────────────────
   Verifies a Bearer token and confirms the admin account is still active.
   Attaches decoded admin data to req.admin.
────────────────────────────────────────────────────────────────────────── */
async function requireAdminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (_) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Admin tokens are signed with { id, username, role }
    const adminId = decoded.id || decoded.adminId;
    if (!adminId) return res.status(401).json({ error: 'Unauthorized' });

    const { rows } = await db.query(
      'SELECT id, username, email, role FROM admin_users WHERE id = $1 AND is_active = true',
      [adminId]
    );
    if (!rows[0]) return res.status(401).json({ error: 'Unauthorized' });

    req.admin = rows[0];
    return next();
  } catch (err) {
    console.error('[requireAdminAuth]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   requireCustomerAuth
   ────────────────────
   Verifies a Bearer token issued during customer login/register.
   Attaches req.userId and req.userRole for downstream use.
────────────────────────────────────────────────────────────────────────── */
async function requireCustomerAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (_) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Customer tokens are signed with { userId, role }
  const userId = decoded.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { rows } = await db.query(
      'SELECT id, role FROM users WHERE id = $1',
      [userId]
    );
    if (!rows[0]) return res.status(401).json({ error: 'Unauthorized' });

    req.userId   = rows[0].id;
    req.userRole = rows[0].role;
    return next();
  } catch (err) {
    console.error('[requireCustomerAuth]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   requireRole
   ────────────
   Restricts access to admin roles. Must be used after requireAdminAuth.
────────────────────────────────────────────────────────────────────────── */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}

// Semantic alias for older public-route code that uses requireAuth
const requireAuth  = requireCustomerAuth;
const requireAdmin = requireAdminAuth;

module.exports = { requireAdminAuth, requireCustomerAuth, requireAuth, requireAdmin, requireRole };
