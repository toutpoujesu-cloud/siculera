'use strict';

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../models/db');

/* ─── helpers ─────────────────────────────────────────────────────────────── */

async function logAudit(adminId, action, ip, details) {
  try {
    await db.query(
      `INSERT INTO audit_log (admin_id, action, ip_address, details)
       VALUES ($1, $2, $3, $4)`,
      [adminId, action, ip, details ? JSON.stringify(details) : null]
    );
  } catch (_) { /* audit failures must never break the request */ }
}

function signToken(admin) {
  return jwt.sign(
    { id: admin.id, username: admin.username, email: admin.email, role: admin.role },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}

/* ─── POST /api/auth/admin/login ───────────────────────────────────────────── */

async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const { rows } = await db.query(
      `SELECT * FROM admin_users
       WHERE (username = $1 OR email = $1) AND is_active = true`,
      [username]
    );

    const admin = rows[0];

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last_login timestamp
    await db.query(
      'UPDATE admin_users SET last_login = NOW() WHERE id = $1',
      [admin.id]
    );

    // Audit log
    await logAudit(admin.id, 'admin_login', req.ip, { username: admin.username });

    const token = signToken(admin);

    return res.json({
      token,
      admin: {
        id:       admin.id,
        username: admin.username,
        email:    admin.email,
        role:     admin.role
      }
    });
  } catch (err) {
    console.error('[authController.login]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* ─── POST /api/auth/admin/logout ──────────────────────────────────────────── */

async function logout(req, res) {
  try {
    await logAudit(req.admin.id, 'admin_logout', req.ip, null);
    return res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('[authController.logout]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* ─── GET /api/auth/admin/me ───────────────────────────────────────────────── */

async function me(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT id, username, email, role, last_login, created_at
       FROM admin_users
       WHERE id = $1 AND is_active = true`,
      [req.admin.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error('[authController.me]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* ─── POST /api/auth/admin/change-password ─────────────────────────────────── */

async function changePassword(req, res) {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'current_password and new_password are required' });
  }

  if (new_password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  try {
    const { rows } = await db.query(
      'SELECT * FROM admin_users WHERE id = $1 AND is_active = true',
      [req.admin.id]
    );

    const admin = rows[0];
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const valid = await bcrypt.compare(current_password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(new_password, 12);

    await db.query(
      'UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hashed, admin.id]
    );

    await logAudit(admin.id, 'admin_change_password', req.ip, null);

    return res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('[authController.changePassword]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { login, logout, me, changePassword };
