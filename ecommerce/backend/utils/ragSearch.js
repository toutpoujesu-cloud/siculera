'use strict';

/**
 * RAG (Retrieval-Augmented Generation) via PostgreSQL Full-Text Search.
 *
 * Queries `chat_document_chunks` using the generated TSVECTOR column
 * and returns the top-K most relevant chunks for the given query text.
 */

const db = require('../models/db');

/**
 * Search the knowledge base for chunks relevant to the query.
 *
 * @param {string} queryText        - User's question / keywords
 * @param {object} [opts]
 * @param {number} [opts.limit=5]   - Max chunks to return
 * @param {string} [opts.language='english'] - PostgreSQL text-search language
 * @returns {Promise<Array<{content: string, document_name: string, rank: number}>>}
 */
async function search(queryText, opts = {}) {
  const limit    = opts.limit    || 5;
  const language = opts.language || 'english';

  if (!queryText || !queryText.trim()) return [];

  try {
    const { rows } = await db.query(
      `SELECT
         c.content,
         d.original_name  AS document_name,
         ts_rank(c.tsv, plainto_tsquery($1, $2)) AS rank
       FROM   chat_document_chunks c
       JOIN   chat_documents       d ON c.document_id = d.id
       WHERE  d.is_active = true
         AND  c.tsv @@ plainto_tsquery($1, $2)
       ORDER  BY rank DESC
       LIMIT  $3`,
      [language, queryText.trim(), limit]
    );
    return rows;
  } catch (err) {
    console.error('[RAG] search error:', err.message);
    return [];
  }
}

/**
 * Format retrieved chunks into a context string for injection into the system prompt.
 *
 * @param {Array} chunks   - Result of search()
 * @returns {string}
 */
function formatContext(chunks) {
  if (!chunks || !chunks.length) return '';
  const sections = chunks.map((c, i) =>
    `[Source ${i + 1}: ${c.document_name}]\n${c.content}`
  );
  return '--- Knowledge Base Context ---\n' + sections.join('\n\n') + '\n--- End Context ---';
}

module.exports = { search, formatContext };
