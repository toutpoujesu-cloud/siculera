'use strict';

/**
 * Siculera AI Chat — Admin Controller
 *
 * Handles:
 *   GET/POST  /api/admin/chat/config         — load/save AI chat configuration
 *   GET       /api/admin/chat/models         — model list for a provider
 *   GET/POST/DELETE /api/admin/chat/documents — knowledge base management
 *   GET       /api/admin/chat/sessions       — paginated conversation list
 *   GET       /api/admin/chat/sessions/:id/messages — full thread
 *   GET       /api/admin/chat/analytics      — stats cards
 */

const path    = require('path');
const fs      = require('fs');
const db      = require('../models/db');
const {
  encryptSensitiveFields,
  decryptAndMaskFields,
  decryptAllFields,
  SENSITIVE_SUFFIXES
} = require('../utils/encryption');
const { getModelList }  = require('../utils/llm/llmProvider');
const docProcessor      = require('../utils/docProcessor');

// ── Config ────────────────────────────────────────────────────────────────────

const chatAdminController = {

  // Keep stored secret values when admin submits masked placeholders like "****abcd".
  _mergeConfigPreservingSecrets(current, incoming) {
    const out = { ...(current || {}) };
    for (const [key, val] of Object.entries(incoming || {})) {
      if (key.endsWith('__encrypted')) continue;

      const currentVal = out[key];

      if (val && typeof val === 'object' && !Array.isArray(val)) {
        out[key] = this._mergeConfigPreservingSecrets(
          (currentVal && typeof currentVal === 'object' && !Array.isArray(currentVal)) ? currentVal : {},
          val
        );
        continue;
      }

      const isSensitive = SENSITIVE_SUFFIXES.some(s => key.toLowerCase().endsWith(s));
      const isMaskedPlaceholder = typeof val === 'string' && val.includes('*');
      const isBlankSensitive = typeof val === 'string' && val.trim() === '';

      if (isSensitive && (isMaskedPlaceholder || isBlankSensitive) && currentVal) {
        out[key] = currentVal;
      } else {
        out[key] = val;
      }
    }
    return out;
  },

  /**
   * GET /api/admin/chat/config
   */
  async getConfig(req, res) {
    try {
      const { rows } = await db.query("SELECT value FROM settings WHERE key = 'ai_chat_config'");
      if (!rows.length) return res.json({});

      const raw    = JSON.parse(rows[0].value);
      const masked = decryptAndMaskFields(raw);
      return res.json(masked);
    } catch (err) {
      console.error('[chatAdmin] getConfig error:', err);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * POST /api/admin/chat/config
   */
  async saveConfig(req, res) {
    try {
      const incoming = req.body || {};

      // Load current config and decrypt to avoid re-encrypting ciphertext on each save.
      let currentEncrypted = {};
      try {
        const { rows } = await db.query("SELECT value FROM settings WHERE key = 'ai_chat_config'");
        if (rows.length) currentEncrypted = JSON.parse(rows[0].value);
      } catch { /* first save */ }

      const currentPlain = decryptAllFields(currentEncrypted || {});

      const mergedPlain = this._mergeConfigPreservingSecrets(currentPlain, incoming);

      const encrypted = encryptSensitiveFields(mergedPlain);
      const json      = JSON.stringify(encrypted);

      await db.query(
        `INSERT INTO settings (key, value)
         VALUES ('ai_chat_config', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1`,
        [json]
      );

      const masked = decryptAndMaskFields(encrypted);
      return res.json({ success: true, config: masked });
    } catch (err) {
      console.error('[chatAdmin] saveConfig error:', err);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * GET /api/admin/chat/models?provider=anthropic
   */
  getModels(req, res) {
    try {
      const provider = (req.query.provider || 'anthropic').toLowerCase();
      const models   = getModelList(provider);
      return res.json({ provider, models });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  // ── Documents ────────────────────────────────────────────────────────────

  /**
   * GET /api/admin/chat/documents
   */
  async getDocuments(req, res) {
    try {
      const { rows } = await db.query(
        `SELECT id, original_name, mime_type, file_size, description,
                is_active, chunk_count, created_at
         FROM   chat_documents
         ORDER  BY created_at DESC`
      );
      return res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * POST /api/admin/chat/documents  (multipart/form-data)
   * Multer middleware applied in the router.
   */
  async uploadDocument(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { originalname, filename, mimetype, size, path: filePath } = req.file;
      const description = req.body?.description || '';
      const adminId     = req.admin?.id || null;

      // Insert document record
      const { rows } = await db.query(
        `INSERT INTO chat_documents
           (filename, original_name, mime_type, file_size, file_path, description, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id`,
        [
          filename,
          originalname,
          mimetype,
          size,
          `uploads/chat-docs/${filename}`,
          description,
          adminId
        ]
      );
      const documentId = rows[0].id;

      // Process document asynchronously (don't block response)
      docProcessor.processDocument(filePath, mimetype, documentId)
        .then(count => {
          console.log(`[chatAdmin] Processed "${originalname}" — ${count} chunks`);
        })
        .catch(err => {
          console.error(`[chatAdmin] processDocument error for "${originalname}":`, err.message);
        });

      return res.status(201).json({
        success:     true,
        document_id: documentId,
        filename:    originalname,
        message:     'Document uploaded. It is being processed and will be available in the knowledge base shortly.'
      });
    } catch (err) {
      console.error('[chatAdmin] uploadDocument error:', err);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * PATCH /api/admin/chat/documents/:id
   * Toggle active status or update description.
   */
  async updateDocument(req, res) {
    try {
      const { id }        = req.params;
      const { is_active, description } = req.body || {};

      const updates = [];
      const values  = [id];

      if (is_active !== undefined) {
        values.push(is_active);
        updates.push(`is_active = $${values.length}`);
      }
      if (description !== undefined) {
        values.push(description);
        updates.push(`description = $${values.length}`);
      }

      if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

      const { rows } = await db.query(
        `UPDATE chat_documents SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
        values
      );

      if (!rows.length) return res.status(404).json({ error: 'Document not found' });
      return res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * DELETE /api/admin/chat/documents/:id
   */
  async deleteDocument(req, res) {
    try {
      const { id } = req.params;

      // Get file path before deleting
      const { rows } = await db.query(
        'SELECT file_path FROM chat_documents WHERE id = $1',
        [id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Document not found' });

      await db.query('DELETE FROM chat_documents WHERE id = $1', [id]);

      // Delete physical file
      try {
        const fullPath = path.join(process.cwd(), rows[0].file_path);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } catch (e) {
        console.warn('[chatAdmin] Could not delete file:', e.message);
      }

      return res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // ── Sessions / Conversations ──────────────────────────────────────────────

  /**
   * GET /api/admin/chat/sessions?page=1&limit=20&escalated=true
   */
  async getSessions(req, res) {
    try {
      const page      = Math.max(1, parseInt(req.query.page)  || 1);
      const limit     = Math.min(100, parseInt(req.query.limit) || 20);
      const offset    = (page - 1) * limit;
      const escalated = req.query.escalated === 'true';

      let where = '';
      const params = [limit, offset];

      if (escalated) {
        where = 'WHERE s.human_escalated = TRUE';
      }

      const { rows } = await db.query(
        `SELECT
           s.id, s.session_token, s.channel, s.language_detected,
           s.consent_given, s.human_escalated, s.ended_at,
           s.created_at, s.updated_at,
           u.email AS user_email,
           COUNT(m.id)::int AS message_count
         FROM   chat_sessions s
         LEFT JOIN users          u ON s.user_id = u.id
         LEFT JOIN chat_messages  m ON m.session_id = s.id
         ${where}
         GROUP BY s.id, u.email
         ORDER BY s.updated_at DESC
         LIMIT $1 OFFSET $2`,
        params
      );

      const countResult = await db.query(
        `SELECT COUNT(*)::int FROM chat_sessions s ${where}`
      );

      return res.json({
        sessions: rows,
        total:    countResult.rows[0].count,
        page,
        limit
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * GET /api/admin/chat/sessions/:id/messages
   */
  async getSessionMessages(req, res) {
    try {
      const { id } = req.params;

      const { rows: [session] } = await db.query(
        'SELECT * FROM chat_sessions WHERE id = $1',
        [id]
      );
      if (!session) return res.status(404).json({ error: 'Session not found' });

      const { rows: messages } = await db.query(
        `SELECT id, role, content, tool_name, tool_call_id, tool_args,
                tool_result, tokens_used, model_used, latency_ms, flagged, created_at
         FROM   chat_messages
         WHERE  session_id = $1
         ORDER  BY created_at ASC`,
        [id]
      );

      return res.json({ session, messages });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // ── Analytics ─────────────────────────────────────────────────────────────

  /**
   * GET /api/admin/chat/analytics
   */
  async getAnalytics(req, res) {
    try {
      const [
        sessionsResult,
        messagesResult,
        ordersResult,
        escalationsResult,
        monthlyResult,
        topSearchesResult
      ] = await Promise.all([
        db.query('SELECT COUNT(*)::int AS total FROM chat_sessions'),
        db.query("SELECT COUNT(*)::int AS total FROM chat_messages WHERE role = 'user'"),
        db.query('SELECT COUNT(*)::int AS total FROM chat_orders'),
        db.query('SELECT COUNT(*)::int AS total FROM chat_sessions WHERE human_escalated = TRUE'),
        db.query(`
          SELECT
            TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
            COUNT(*)::int AS sessions
          FROM   chat_sessions
          WHERE  created_at >= NOW() - INTERVAL '6 months'
          GROUP  BY 1
          ORDER  BY 1 ASC
        `),
        db.query(`
          SELECT
            tool_args->>'query' AS search_query,
            COUNT(*)::int AS count
          FROM   chat_messages
          WHERE  tool_name = 'search_knowledge_base'
            AND  tool_args->>'query' IS NOT NULL
          GROUP  BY 1
          ORDER  BY count DESC
          LIMIT  10
        `)
      ]);

      return res.json({
        stats: {
          total_sessions:   sessionsResult.rows[0].total,
          total_messages:   messagesResult.rows[0].total,
          total_orders:     ordersResult.rows[0].total,
          total_escalations: escalationsResult.rows[0].total
        },
        monthly_sessions: monthlyResult.rows,
        top_searches:     topSearchesResult.rows
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = chatAdminController;
