'use strict';

/**
 * Document Processor — PDF / DOCX / TXT → text chunks → DB
 *
 * Used by the admin Knowledge Base upload endpoint.
 * After chunking, inserts rows into chat_document_chunks.
 * PostgreSQL's GENERATED ALWAYS AS TSVECTOR column is auto-populated.
 */

const fs   = require('fs');
const path = require('path');
const db   = require('../models/db');

const CHUNK_SIZE    = 500;  // target chars per chunk
const CHUNK_OVERLAP = 80;   // chars of overlap between chunks

// ── Text extractors (lazy loaded) ─────────────────────────────────────────────

async function extractPDF(filePath) {
  const pdfParse = require('pdf-parse');
  const buffer   = fs.readFileSync(filePath);
  const data     = await pdfParse(buffer);
  return data.text || '';
}

async function extractDOCX(filePath) {
  const mammoth = require('mammoth');
  const result  = await mammoth.extractRawText({ path: filePath });
  return result.value || '';
}

async function extractTXT(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Extract raw text from a file based on its mime type.
 */
async function extractText(filePath, mimeType) {
  const ext = path.extname(filePath).toLowerCase();

  if (mimeType === 'application/pdf' || ext === '.pdf') {
    return extractPDF(filePath);
  }
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword' ||
    ext === '.docx' || ext === '.doc'
  ) {
    return extractDOCX(filePath);
  }
  // Fallback: treat as plain text
  return extractTXT(filePath);
}

// ── Chunker ──────────────────────────────────────────────────────────────────

/**
 * Split text into overlapping chunks of ~CHUNK_SIZE characters.
 * Splits on paragraph breaks first, then sentence boundaries.
 */
function chunkText(text) {
  if (!text || !text.trim()) return [];

  // Normalise whitespace
  const clean = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Split on paragraph breaks
  const paragraphs = clean.split(/\n\n+/).filter(p => p.trim());

  const chunks = [];
  let   buffer = '';

  for (const para of paragraphs) {
    const sentences = para.split(/(?<=[.!?])\s+/);

    for (const sentence of sentences) {
      if ((buffer + ' ' + sentence).trim().length > CHUNK_SIZE && buffer.length > 0) {
        chunks.push(buffer.trim());
        // Overlap: carry last CHUNK_OVERLAP chars into next chunk
        buffer = buffer.slice(-CHUNK_OVERLAP) + ' ' + sentence;
      } else {
        buffer = buffer ? buffer + ' ' + sentence : sentence;
      }
    }

    // Paragraph ends — push if buffer is getting full
    if (buffer.length >= CHUNK_SIZE * 0.8) {
      chunks.push(buffer.trim());
      buffer = buffer.slice(-CHUNK_OVERLAP);
    } else {
      buffer += '\n\n';
    }
  }

  if (buffer.trim()) {
    chunks.push(buffer.trim());
  }

  return chunks.filter(c => c.length > 20); // discard tiny fragments
}

// ── DB insertion ──────────────────────────────────────────────────────────────

/**
 * Store chunks into chat_document_chunks for a given document.
 * Returns the number of chunks stored.
 */
async function storeChunks(documentId, chunks) {
  if (!chunks.length) return 0;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Delete any existing chunks for this document (re-processing)
    await client.query('DELETE FROM chat_document_chunks WHERE document_id = $1', [documentId]);

    for (let i = 0; i < chunks.length; i++) {
      await client.query(
        `INSERT INTO chat_document_chunks (document_id, chunk_index, content, char_count)
         VALUES ($1, $2, $3, $4)`,
        [documentId, i, chunks[i], chunks[i].length]
      );
    }

    // Update chunk count on parent document
    await client.query(
      'UPDATE chat_documents SET chunk_count = $2 WHERE id = $1',
      [documentId, chunks.length]
    );

    await client.query('COMMIT');
    return chunks.length;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Full pipeline: extract text → chunk → store in DB.
 *
 * @param {string} filePath    - Absolute path to the file
 * @param {string} mimeType    - MIME type
 * @param {string} documentId  - UUID of the chat_documents row
 * @returns {Promise<number>}  - Number of chunks stored
 */
async function processDocument(filePath, mimeType, documentId) {
  const text   = await extractText(filePath, mimeType);
  const chunks = chunkText(text);
  return storeChunks(documentId, chunks);
}

module.exports = { processDocument, extractText, chunkText, storeChunks };
