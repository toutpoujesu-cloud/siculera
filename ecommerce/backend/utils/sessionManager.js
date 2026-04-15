'use strict';

/**
 * Chat Session Manager
 *
 * Handles:
 *  - Session creation (guest + authenticated)
 *  - Session lookup by token
 *  - Guest fingerprinting (SHA-256 of IP + UA + day — never raw PII)
 *  - In-memory per-session rate limiting (backed by DB session row)
 *  - Session lifecycle (end, escalate)
 */

const crypto = require('crypto');
const db     = require('../models/db');

// ── In-memory rate-limit counters (keyed by session_token) ──────────────────
// { token → { count, resetAt } }
const _rateLimitMap = new Map();

// ── In-memory session store (fallback when DB is unavailable) ────────────────
// { token → session-object }
const _sessionStore = new Map();

/**
 * Generate a 32-byte random hex session token.
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Compute a guest fingerprint from request metadata.
 * SHA-256(ip + userAgent + YYYY-MM-DD) — rotates daily, never stores raw PII.
 */
function guestFingerprint(req) {
  const ip  = req.ip || req.connection?.remoteAddress || 'unknown';
  const ua  = req.headers['user-agent'] || 'unknown';
  const day = new Date().toISOString().slice(0, 10);
  return crypto.createHash('sha256').update(`${ip}|${ua}|${day}`).digest('hex');
}

/**
 * Create a new chat session in the database.
 *
 * @param {object} opts
 * @param {object} opts.req          - Express request (for fingerprint)
 * @param {string} [opts.userId]     - UUID if authenticated
 * @param {string} [opts.channel]    - 'widget' | 'embed' | 'api'
 * @returns {Promise<object>}        - session row
 */
async function createSession(opts = {}) {
  const token       = generateToken();
  const fingerprint = guestFingerprint(opts.req || {});
  const channel     = opts.channel || 'widget';
  const userId      = opts.userId  || null;

  try {
    const { rows } = await db.query(
      `INSERT INTO chat_sessions
         (session_token, user_id, guest_fingerprint, channel)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [token, userId, fingerprint, channel]
    );
    return rows[0];
  } catch (err) {
    console.warn('[sessionMgr] DB unavailable, using in-memory session:', err.message);
    const session = {
      id:                 crypto.randomUUID(),
      session_token:      token,
      user_id:            userId,
      guest_fingerprint:  fingerprint,
      channel,
      language_detected:  null,
      consent_given:      false,
      consent_at:         null,
      human_escalated:    false,
      human_escalated_at: null,
      escalation_reason:  null,
      ended_at:           null,
      created_at:         new Date(),
      updated_at:         new Date()
    };
    _sessionStore.set(token, session);
    return session;
  }
}

/**
 * Look up a session by token. Returns null if not found.
 */
async function getSession(token) {
  if (!token) return null;
  try {
    const { rows } = await db.query(
      'SELECT * FROM chat_sessions WHERE session_token = $1 LIMIT 1',
      [token]
    );
    return rows[0] || _sessionStore.get(token) || null;
  } catch (err) {
    return _sessionStore.get(token) || null;
  }
}

/**
 * Touch updated_at and optionally set language_detected.
 */
async function touchSession(sessionId, language = null) {
  const mem = [..._sessionStore.values()].find(s => s.id === sessionId);
  if (mem) { mem.updated_at = new Date(); if (language) mem.language_detected = language; }
  try {
    await db.query(
      `UPDATE chat_sessions
       SET updated_at = NOW()
           ${language ? ", language_detected = $2" : ""}
       WHERE id = $1`,
      language ? [sessionId, language] : [sessionId]
    );
  } catch (_) {}
}

/**
 * Mark consent for a session.
 */
async function setConsent(sessionId, given) {
  const mem = [..._sessionStore.values()].find(s => s.id === sessionId);
  if (mem) { mem.consent_given = given; mem.consent_at = given ? new Date() : null; mem.updated_at = new Date(); }
  try {
    await db.query(
      `UPDATE chat_sessions
       SET consent_given = $2,
           consent_at    = CASE WHEN $2 = true THEN NOW() ELSE NULL END,
           updated_at    = NOW()
       WHERE id = $1`,
      [sessionId, given]
    );
  } catch (_) {}
}

/**
 * Mark a session as escalated to human.
 */
async function escalateSession(sessionId, reason = '') {
  const mem = [..._sessionStore.values()].find(s => s.id === sessionId);
  if (mem) { mem.human_escalated = true; mem.human_escalated_at = new Date(); mem.escalation_reason = reason; mem.updated_at = new Date(); }
  try {
    await db.query(
      `UPDATE chat_sessions
       SET human_escalated    = TRUE,
           human_escalated_at = NOW(),
           escalation_reason  = $2,
           updated_at         = NOW()
       WHERE id = $1`,
      [sessionId, reason]
    );
  } catch (_) {}
}

/**
 * Mark a session as ended.
 */
async function endSession(sessionId) {
  const mem = [..._sessionStore.values()].find(s => s.id === sessionId);
  if (mem) { mem.ended_at = new Date(); mem.updated_at = new Date(); }
  try {
    await db.query(
      `UPDATE chat_sessions
       SET ended_at   = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [sessionId]
    );
  } catch (_) {}
}

/**
 * Per-session in-memory rate limit check.
 * Returns { allowed: bool, remaining: number, resetIn: number (ms) }
 *
 * @param {string} token      - session token (used as key)
 * @param {number} maxPerMin  - max messages per minute
 */
function checkRateLimit(token, maxPerMin = 20) {
  const now  = Date.now();
  let   slot = _rateLimitMap.get(token);

  if (!slot || now >= slot.resetAt) {
    slot = { count: 0, resetAt: now + 60_000 };
  }

  slot.count += 1;
  _rateLimitMap.set(token, slot);

  const remaining = Math.max(0, maxPerMin - slot.count);
  const resetIn   = Math.max(0, slot.resetAt - now);

  return {
    allowed:   slot.count <= maxPerMin,
    remaining,
    resetIn
  };
}

/**
 * Cleanup old in-memory rate-limit entries every 5 minutes.
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, slot] of _rateLimitMap.entries()) {
    if (now >= slot.resetAt) _rateLimitMap.delete(key);
  }
}, 5 * 60_000);

module.exports = {
  generateToken,
  guestFingerprint,
  createSession,
  getSession,
  touchSession,
  setConsent,
  escalateSession,
  endSession,
  checkRateLimit
};
