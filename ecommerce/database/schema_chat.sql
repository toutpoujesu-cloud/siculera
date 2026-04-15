-- Siculera AI Chat System — Database Migration
-- Run AFTER schema.sql
-- psql -U siculera_user -d siculera -f database/schema_chat.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Chat Sessions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_token      VARCHAR(64) UNIQUE NOT NULL,  -- 32-byte random hex, stored in widget localStorage
  user_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  guest_fingerprint  VARCHAR(128),                 -- SHA-256(IP+UA+day), never raw PII
  channel            VARCHAR(30) DEFAULT 'widget'
                     CHECK (channel IN ('widget','embed','api')),
  language_detected  VARCHAR(10),                  -- BCP-47 e.g. "it", "en"
  consent_given      BOOLEAN DEFAULT FALSE,        -- GDPR: gates message persistence
  consent_at         TIMESTAMPTZ,
  human_escalated    BOOLEAN DEFAULT FALSE,
  human_escalated_at TIMESTAMPTZ,
  escalation_reason  TEXT,
  ended_at           TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user    ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_token   ON chat_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created ON chat_sessions(created_at);

-- ── Chat Messages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role          VARCHAR(20) NOT NULL
                CHECK (role IN ('user','assistant','tool','system')),
  content       TEXT,           -- null when role='tool' and tool_result is set
  tool_name     VARCHAR(80),    -- which tool was called
  tool_call_id  VARCHAR(120),   -- LLM-assigned ID for pairing call ↔ result
  tool_args     JSONB,          -- arguments the LLM passed
  tool_result   JSONB,          -- result returned from dispatchTool()
  tokens_used   INTEGER,        -- prompt + completion tokens
  model_used    VARCHAR(80),    -- e.g. "claude-3-5-sonnet-20241022"
  latency_ms    INTEGER,        -- wall-clock LLM round-trip
  flagged       BOOLEAN DEFAULT FALSE,  -- set by escalate_to_human
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_flagged ON chat_messages(flagged) WHERE flagged = TRUE;

-- ── Knowledge Base Documents ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename      VARCHAR(255) NOT NULL,   -- stored filename on disk
  original_name VARCHAR(255) NOT NULL,  -- original uploaded name
  mime_type     VARCHAR(80),
  file_size     INTEGER,
  file_path     VARCHAR(500) NOT NULL,  -- relative: uploads/chat-docs/filename
  description   TEXT,                   -- admin-entered label
  is_active     BOOLEAN DEFAULT TRUE,
  uploaded_by   UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  chunk_count   INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Knowledge Base Chunks (RAG) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_document_chunks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES chat_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content     TEXT NOT NULL,
  char_count  INTEGER,
  -- PostgreSQL generated tsvector column — auto-updated on INSERT/UPDATE
  tsv         TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_chunks_doc ON chat_document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chat_chunks_tsv ON chat_document_chunks USING GIN(tsv);

-- ── Orders Placed via Chat (analytics) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_orders (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  order_id   UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_orders_session ON chat_orders(session_id);

-- ── Seed default AI chat config ───────────────────────────────────────────────
INSERT INTO settings (key, value) VALUES (
  'ai_chat_config',
  '{
    "enabled": false,
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "api_key": "",
    "temperature": 0.7,
    "personality": "warm",
    "custom_system_prompt": "",
    "supported_languages": ["auto"],
    "can_place_orders": false,
    "can_handle_gdpr": false,
    "can_suggest_products": true,
    "tsvector_language": "english",
    "max_rag_chunks": 5,
    "max_context_messages": 20,
    "ollama_base_url": "http://localhost:11434"
  }'
) ON CONFLICT (key) DO NOTHING;
