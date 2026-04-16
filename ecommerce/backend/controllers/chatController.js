'use strict';

/**
 * Siculera AI Chat — Public Controller
 *
 * Handles:
 *   POST /api/chat/session    — create or resume session
 *   POST /api/chat/message    — main chat endpoint (agentic loop)
 *   POST /api/chat/consent    — update GDPR consent
 *   POST /api/chat/escalate   — direct escalation (fallback without AI)
 */

const db              = require('../models/db');
const { getLLMProvider }  = require('../utils/llm/llmProvider');
const { getEnabledTools, dispatchTool } = require('../utils/chatTools');
const rag             = require('../utils/ragSearch');
const sessionMgr      = require('../utils/sessionManager');
const { decryptAllFields } = require('../utils/encryption');

const MAX_TOOL_ITERATIONS = 5;
const RATE_LIMIT_PER_MIN  = parseInt(process.env.CHAT_RATE_LIMIT_PER_MIN) || 20;

// ── Load + decrypt AI chat config from settings ──────────────────────────────

function getEnvFallbackConfig() {
  // Prefer DeepSeek if its key is set, fall back to Anthropic
  const deepseekKey  = process.env.DEEPSEEK_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (deepseekKey) {
    return {
      enabled:              true,
      provider:             'deepseek',
      api_key:              deepseekKey,
      model:                'deepseek-chat',
      temperature:          0.7,
      personality:          'warm',
      can_place_orders:     true,
      can_handle_gdpr:      false,
      can_suggest_products: true,
      max_rag_chunks:       5,
      max_context_messages: 20
    };
  }

  if (anthropicKey) {
    return {
      enabled:              true,
      provider:             'anthropic',
      api_key:              anthropicKey,
      model:                'claude-3-5-sonnet-20241022',
      temperature:          0.7,
      personality:          'warm',
      can_place_orders:     true,
      can_handle_gdpr:      false,
      can_suggest_products: true,
      max_rag_chunks:       5,
      max_context_messages: 20
    };
  }

  return null;
}

function isEncryptedBlob(value) {
  return typeof value === 'string' && /^[0-9a-f]{32}:[0-9a-f]+$/i.test(value);
}

function normalizeApiKeyForProvider(provider, key) {
  if (typeof key !== 'string') return '';
  const trimmed = key.trim();
  if (!trimmed || trimmed.includes('*') || isEncryptedBlob(trimmed)) return '';

  const p = (provider || '').toLowerCase();
  if (p === 'deepseek' && !trimmed.startsWith('sk-')) return '';
  if (p === 'anthropic' && !trimmed.startsWith('sk-')) return '';
  if (p === 'openai' && !trimmed.startsWith('sk-')) return '';

  return trimmed;
}

async function loadChatConfig() {
  try {
    const { rows } = await db.query("SELECT value FROM settings WHERE key = 'ai_chat_config'");
    if (!rows.length) return getEnvFallbackConfig();
    const raw = JSON.parse(rows[0].value);
    const cfg = decryptAllFields(raw);

    // Auto-enable when env API keys are present and admin hasn't explicitly configured yet
    if (!cfg.enabled) {
      const envFallback = getEnvFallbackConfig();
      if (envFallback) {
        // Always use env fallback provider + key when DB has chat disabled.
        // Only preserve DB model if it matches the env provider.
        const model = cfg.model && cfg.provider === envFallback.provider
          ? cfg.model
          : envFallback.model;

        return {
          ...envFallback,
          model,
          enabled: true
        };
      }
    }

    // Merge API key from env if not stored in DB
    if (!cfg.api_key) {
      if (process.env.DEEPSEEK_API_KEY)  cfg.api_key = process.env.DEEPSEEK_API_KEY;
      else if (process.env.ANTHROPIC_API_KEY) cfg.api_key = process.env.ANTHROPIC_API_KEY;
    }

    // Guard against masked/corrupted keys persisted from admin config saves.
    cfg.api_key = normalizeApiKeyForProvider(cfg.provider, cfg.api_key);
    if (!cfg.api_key) {
      if ((cfg.provider || '').toLowerCase() === 'deepseek' && process.env.DEEPSEEK_API_KEY) {
        cfg.api_key = process.env.DEEPSEEK_API_KEY;
      } else if ((cfg.provider || '').toLowerCase() === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
        cfg.api_key = process.env.ANTHROPIC_API_KEY;
      }
    }

    return cfg;
  } catch (err) {
    console.warn('[chat] loadChatConfig DB unavailable, using env fallback:', err.message);
    return getEnvFallbackConfig();
  }
}

// ── System Prompt Builder ────────────────────────────────────────────────────

function buildSystemPrompt(config, cartContext = null, userContext = null) {
  const personality = config.personality || 'warm';
  const brand = `Siculera is a luxury Sicilian artisanal pastry brand. We craft premium almond pastes, pistachio creams, marzipan, and other traditional Sicilian confections. Our products are handmade with authentic Sicilian ingredients — Bronte pistachios, Avola almonds — and are perfect for gifting, celebrations, and everyday indulgence.`;

  const personalities = {
    warm: `You are Siculera's warm and empathetic AI assistant. Your communication style is friendly, caring, and infused with Sicilian hospitality. You love helping customers find the perfect product, especially for gifting. You use gentle suggestions and show genuine interest in the customer's needs. Never be pushy — guide with warmth.`,
    luxury: `You are Siculera's refined luxury concierge. Your communication is sophisticated, elegant, and measured. You present products as curated experiences. You never use casual language or filler words. Every response reflects the premium nature of the brand. "Allow me to present..." and similar refined phrasing.`,
    playful: `You are Siculera's enthusiastic and playful assistant! You're cheerful, fun, and you love sharing the joy of great food. Use emojis sparingly but warmly. You get excited about products and genuinely love helping. Keep responses light and energetic while remaining professional.`,
    formal: `You are Siculera's professional customer service assistant. Be concise, precise, and professional. Use complete sentences. Avoid filler phrases. Provide accurate information efficiently. Always confirm before taking any action.`,
    custom: config.custom_system_prompt || `You are Siculera's AI assistant. Help customers professionally and helpfully.`
  };

  const personalityPrompt = personalities[personality] || personalities.warm;

  const euAiActDisclosure = `IMPORTANT: You must always be transparent that you are an AI assistant, as required by EU AI Act Article 50. If asked whether you are human or AI, always confirm you are an AI. Never impersonate a human agent.`;

  const capabilities = [
    `- Browse and present the full product catalog`,
    `- Provide detailed product information (ingredients, allergens, pricing, stock)`,
    `- Check order status (requires order number + email)`,
    `- Add products to the customer's cart`,
    config.can_place_orders ? `- Place orders via bank transfer or cash on delivery` : null,
    `- Provide shipping options and rates`,
    `- Search the knowledge base for policies, allergens, certifications`,
    config.can_handle_gdpr  ? `- Process GDPR data access and erasure requests` : null,
    `- Escalate to a human support agent at any time`
  ].filter(Boolean).join('\n');

  const salesGuidance = `
SALES GUIDANCE:
- Always suggest complementary products when a customer adds an item (upsell naturally, not aggressively)
- When a customer orders 2+ items, mention our gifting options
- Highlight seasonal specials and best-sellers
- If a product is out of stock, suggest the most similar available alternative
- Always confirm before placing any order — summarise the order and ask for explicit confirmation`;

  const languageGuidance = `
LANGUAGE GUIDANCE:
- Always respond in the same language that the customer uses.
- If the customer writes in Italian, reply in Italian.
- If the customer writes in French, reply in French.
- If the customer writes in English, reply in English.
- If the customer mixes languages, prefer the last language they used.
- Do not switch to another language unless the customer explicitly asks you to.`;

  const cartNote = cartContext && cartContext.length > 0
    ? `\nCURRENT CART: The customer currently has the following items in their cart: ${JSON.stringify(cartContext)}. Reference this context where relevant.`
    : '';

  const userNote = userContext
    ? `\nCUSTOMER PROFILE: ${JSON.stringify(userContext)}. Address them by first name when appropriate.`
    : '';

  const toolInstructions = `
TOOL USAGE RULES (follow strictly):
- When the customer asks to see their cart, what's in their basket, or what they've added — ALWAYS call the \`show_cart\` tool immediately before responding.
- When the customer asks to add a product — ALWAYS call the \`add_to_cart\` tool with the correct slug.
- When the customer asks about products or browsing — ALWAYS call the \`get_products\` tool to show the catalog.
- When the customer asks about an order or tracking — ALWAYS call the \`check_order_status\` tool.
- When the customer says "proceed to checkout", "place my order", "buy now", or similar — start the checkout flow:
  1. Show a summary of their cart items (from cart_context).
  2. Ask for: full name, email address, street address, city, postal code, country, phone number.
  3. Ask for payment method: "Bank Transfer" or "Cash on Delivery" (explain that card payment can be done on the website checkout page).
  4. Confirm all details with the customer before placing.
  5. Call \`initiate_order\` with all collected details. The order will be confirmed inline — do NOT navigate away.
  6. After order is placed, say thank you and offer to help with anything else.
- NEVER redirect to /checkout.html — the entire checkout happens inside this chat.`;

  return [
    euAiActDisclosure,
    '',
    personalityPrompt,
    '',
    brand,
    '',
    `YOUR CAPABILITIES:\n${capabilities}`,
    salesGuidance,
    languageGuidance,
    toolInstructions,
    cartNote,
    userNote
  ].filter(s => s !== null).join('\n');
}

// ── Persist a message to the database ────────────────────────────────────────

async function persistMessage(sessionId, msgData) {
  try {
    await db.query(
      `INSERT INTO chat_messages
         (session_id, role, content, tool_name, tool_call_id, tool_args, tool_result, tokens_used, model_used, latency_ms, flagged)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        sessionId,
        msgData.role,
        msgData.content     || null,
        msgData.tool_name   || null,
        msgData.tool_call_id|| null,
        msgData.tool_args   ? JSON.stringify(msgData.tool_args)   : null,
        msgData.tool_result ? JSON.stringify(msgData.tool_result) : null,
        msgData.tokens_used || null,
        msgData.model_used  || null,
        msgData.latency_ms  || null,
        msgData.flagged     || false
      ]
    );
  } catch (err) {
    console.error('[chat] persistMessage error:', err.message);
  }
}

// ── Load message history from DB ──────────────────────────────────────────────

async function loadHistory(sessionId, maxMessages = 20) {
  try {
    const { rows } = await db.query(
      `SELECT role, content, tool_name, tool_call_id, tool_args, tool_result
       FROM   chat_messages
       WHERE  session_id = $1
         AND  role IN ('user', 'assistant', 'tool')
       ORDER  BY created_at DESC
       LIMIT  $2`,
      [sessionId, maxMessages]
    );
    return rows.reverse().map(r => {
      if (r.role === 'tool') {
        return {
          role:         'tool',
          tool_call_id: r.tool_call_id || '',
          tool_name:    r.tool_name    || '',
          tool_result:  r.tool_result  || {}
        };
      }
      return { role: r.role, content: r.content || '' };
    });
  } catch {
    return [];
  }
}

// ── Controller ────────────────────────────────────────────────────────────────

const chatController = {

  /**
   * POST /api/chat/session
   * Create or resume a session. Returns session_token.
   */
  async createSession(req, res) {
    try {
      const { session_token, user_id } = req.body || {};

      // Try to resume existing session
      if (session_token) {
        const existing = await sessionMgr.getSession(session_token);
        if (existing && !existing.ended_at) {
          return res.json({
            session_token: existing.session_token,
            consent_given: existing.consent_given,
            resumed:       true
          });
        }
      }

      // Create new session
      const session = await sessionMgr.createSession({
        req,
        userId:  user_id || null,
        channel: 'widget'
      });

      return res.json({
        session_token: session.session_token,
        consent_given: session.consent_given,
        resumed:       false
      });
    } catch (err) {
      console.error('[chat] createSession error:', err);
      res.status(500).json({ error: 'Could not create session' });
    }
  },

  /**
   * POST /api/chat/message
   * Main chat endpoint — agentic loop with up to 5 tool iterations.
   */
  async sendMessage(req, res) {
    const startTime = Date.now();

    try {
      const { session_token, message, cart_context, user_context, user_token, client_history } = req.body || {};

      if (!session_token) {
        return res.status(400).json({ error: 'session_token is required' });
      }
      if (!message || !message.trim()) {
        return res.status(400).json({ error: 'message is required' });
      }

      // ── Rate limiting ──────────────────────────────────────────────────
      const rateCheck = sessionMgr.checkRateLimit(session_token, RATE_LIMIT_PER_MIN);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          error:    'Too many messages. Please wait a moment before sending another.',
          reset_in: rateCheck.resetIn
        });
      }

      // ── Resolve session ────────────────────────────────────────────────
      const session = await sessionMgr.getSession(session_token);
      if (!session) {
        return res.status(404).json({ error: 'Session not found. Please refresh to start a new chat.' });
      }
      if (session.ended_at) {
        return res.status(400).json({ error: 'This session has ended. Please start a new chat.' });
      }

      // ── Load config ────────────────────────────────────────────────────
      const config = await loadChatConfig();
      if (!config || !config.enabled) {
        return res.status(503).json({ error: 'The AI chat assistant is currently unavailable.' });
      }

      const providerName = (config.provider || 'anthropic').toLowerCase();
      if (providerName !== 'ollama' && !normalizeApiKeyForProvider(providerName, config.api_key)) {
        return res.status(503).json({
          error: 'The AI chat assistant is temporarily unavailable.',
          reply: 'Our assistant is temporarily unavailable due to a configuration issue. Please try again shortly, or click "Talk to a human" for immediate help.'
        });
      }

      // ── Resolve user identity ──────────────────────────────────────────
      let userId     = session.user_id || null;
      let guestEmail = null;

      if (user_token && !userId) {
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(user_token, process.env.JWT_SECRET);
          userId = decoded.id || decoded.userId || null;
        } catch { /* guest */ }
      }

      // ── Touch session ──────────────────────────────────────────────────
      await sessionMgr.touchSession(session.id);

      // ── Load history ───────────────────────────────────────────────────
      const maxContext = config.max_context_messages || 20;
      let history      = await loadHistory(session.id, maxContext);

      // When DB is unavailable, fall back to client-supplied history
      if (!history.length && Array.isArray(client_history) && client_history.length) {
        history = client_history
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .slice(-maxContext)
          .map(m => ({ role: m.role, content: String(m.content || '') }));
      }

      // ── Build messages array ───────────────────────────────────────────
      const systemPrompt = buildSystemPrompt(config, cart_context, user_context);

      const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user',   content: message.trim() }
      ];

      // ── Persist user message ───────────────────────────────────────────
      if (session.consent_given) {
        await persistMessage(session.id, { role: 'user', content: message.trim() });
      }

      // ── Get LLM provider ───────────────────────────────────────────────
      const provider = getLLMProvider(
        providerName,
        config.api_key  || process.env.ANTHROPIC_API_KEY,
        { ollamaBaseUrl: config.ollama_base_url }
      );

      const llmConfig = {
        model:       config.model       || 'claude-3-5-sonnet-20241022',
        max_tokens:  config.max_tokens  || 1024,
        temperature: config.temperature != null ? config.temperature : 0.7
      };

      const tools   = getEnabledTools(config);
      const actions = []; // filled by dispatchTool calls

      // ── Agentic loop ───────────────────────────────────────────────────
      let finalReply     = null;
      let totalTokens    = 0;
      let lastModelUsed  = llmConfig.model;

      for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        const iterStart  = Date.now();
        const response   = await provider.chat(messages, tools, llmConfig);
        const iterMs     = Date.now() - iterStart;

        totalTokens   += (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0);
        lastModelUsed  = llmConfig.model;

        // No tool calls — we have the final answer
        if (!response.tool_calls || !response.tool_calls.length) {
          finalReply = response.content || '';

          if (session.consent_given) {
            await persistMessage(session.id, {
              role:       'assistant',
              content:    finalReply,
              tokens_used: totalTokens,
              model_used:  lastModelUsed,
              latency_ms:  Date.now() - startTime
            });
          }
          break;
        }

        // Add assistant message with tool calls to context
        messages.push({
          role:       'assistant',
          content:    response.content || null,
          tool_calls: response.tool_calls
        });

        // Execute each tool call
        for (const tc of response.tool_calls) {
          const toolResult = await dispatchTool(tc.name, tc.args || {}, {
            session,
            config,
            userId,
            guestEmail,
            actions
          });

          // Add tool result to messages
          messages.push({
            role:         'tool',
            tool_call_id: tc.id,
            tool_name:    tc.name,
            tool_result:  toolResult
          });

          // Persist tool call + result
          if (session.consent_given) {
            await persistMessage(session.id, {
              role:         'assistant',
              content:      response.content || null,
              tool_name:    tc.name,
              tool_call_id: tc.id,
              tool_args:    tc.args,
              tokens_used:  response.usage ? (response.usage.prompt_tokens + response.usage.completion_tokens) : null,
              model_used:   lastModelUsed,
              latency_ms:   iterMs
            });
            await persistMessage(session.id, {
              role:         'tool',
              tool_call_id: tc.id,
              tool_name:    tc.name,
              tool_result:  toolResult
            });
          }
        }

        // If this was the last iteration, get a final response without tools
        if (iteration === MAX_TOOL_ITERATIONS - 1) {
          const finalResponse = await provider.chat(messages, [], llmConfig);
          finalReply = finalResponse.content || 'I\'ve completed the requested actions.';

          if (session.consent_given) {
            await persistMessage(session.id, {
              role:      'assistant',
              content:   finalReply,
              model_used: lastModelUsed,
              latency_ms: Date.now() - startTime
            });
          }
        }
      }

      // ── Build quick replies ────────────────────────────────────────────
      const quickReplies = buildQuickReplies(actions, finalReply);

      return res.json({
        reply:         finalReply || '',
        session_token: session.session_token,
        actions,
        quick_replies: quickReplies,
        latency_ms:    Date.now() - startTime
      });

    } catch (err) {
      console.error('[chat] sendMessage error:', err);

      const msg = String(err?.message || '');
      const upstreamStatus = Number(err?.status || err?.statusCode || 0);
      const isAuthError = upstreamStatus === 401
        || /unauthorized|invalid api key|authentication/i.test(msg);
      const isRateLimited = upstreamStatus === 429 || /rate limit|too many requests/i.test(msg);

      if (isAuthError || isRateLimited) {
        return res.status(503).json({
          error: 'The AI chat assistant is temporarily unavailable.',
          reply: 'Our assistant is temporarily unavailable at the moment. Please try again shortly, or click "Talk to a human" for immediate help.'
        });
      }

      return res.status(200).json({
        degraded: true,
        error: 'Temporary assistant issue',
        debug_error: process.env.NODE_ENV !== 'production' ? msg : undefined,
        reply: 'I apologise — I encountered a technical issue. Please try again in a moment, or click "Talk to a human" for immediate assistance.',
        quick_replies: ['Talk to a human']
      });
    }
  },

  /**
   * POST /api/chat/consent
   * Update GDPR consent preference.
   */
  async updateConsent(req, res) {
    try {
      const { session_token, consent_given } = req.body || {};
      if (!session_token) return res.status(400).json({ error: 'session_token required' });

      const session = await sessionMgr.getSession(session_token);
      if (!session) return res.status(404).json({ error: 'Session not found' });

      await sessionMgr.setConsent(session.id, !!consent_given);
      return res.json({ success: true, consent_given: !!consent_given });
    } catch (err) {
      console.error('[chat] updateConsent error:', err);
      res.status(500).json({ error: 'Could not update consent' });
    }
  },

  /**
   * POST /api/chat/order
   * Direct checkout submission — bypasses AI, calls initiate_order tool directly.
   * Payload: { session_token, checkout_data: { first_name, last_name, email, phone,
   *   street, city, postal, country, shipping_method, shipping_label, shipping_price,
   *   payment_method, items: [{slug, quantity, name, price}] } }
   */
  async submitOrder(req, res) {
    try {
      const { session_token, checkout_data: cd } = req.body || {};
      if (!session_token) return res.status(400).json({ error: 'session_token required' });
      if (!cd || !cd.items || !cd.items.length) return res.status(400).json({ error: 'checkout_data with items required' });

      const session = await sessionMgr.getSession(session_token);
      if (!session) return res.status(404).json({ error: 'Session not found' });

      const config = await loadChatConfig();
      // Allow order even if chat disabled — use env fallback with orders enabled
      const effectiveConfig = config || { can_place_orders: true };
      effectiveConfig.can_place_orders = true;

      const userId = session.user_id || null;
      const actions = [];

      const toolArgs = {
        items: cd.items.map(i => ({ slug: i.slug, quantity: i.quantity || 1 })),
        shipping_address: {
          full_name: `${cd.first_name} ${cd.last_name}`,
          address:   cd.street,
          city:      cd.city,
          postcode:  cd.postal,
          country:   cd.country,
          phone:     cd.phone
        },
        payment_method:  cd.payment_method,
        email:           cd.email,
        shipping_method: cd.shipping_method,
        shipping_cents:  cd.shipping_price != null ? Math.round(cd.shipping_price * 100) : null
      };

      // Add COD surcharge to shipping if applicable
      if (cd.payment_method === 'cash_on_delivery' && toolArgs.shipping_cents != null) {
        toolArgs.shipping_cents += 200; // €2.00 COD fee
      }

      const result = await dispatchTool('initiate_order', toolArgs, {
        session,
        config: effectiveConfig,
        userId,
        guestEmail: cd.email,
        actions
      });

      if (result.error) return res.status(400).json({ error: result.error });

      return res.json({
        success:      true,
        order_number: result.order_number,
        total_eur:    result.total_eur,
        actions
      });

    } catch (err) {
      console.error('[chat] submitOrder error:', err);
      return res.status(500).json({ error: 'Could not place order. Please try again.' });
    }
  },

  /**
   * POST /api/chat/escalate
   * Direct escalation without going through the AI.
   */
  async escalate(req, res) {
    try {
      const { session_token, reason, message: msg } = req.body || {};
      if (!session_token) return res.status(400).json({ error: 'session_token required' });

      const session = await sessionMgr.getSession(session_token);
      if (!session) return res.status(404).json({ error: 'Session not found' });

      await sessionMgr.escalateSession(session.id, reason || 'Customer requested');

      // Email support
      try {
        const mailer     = require('../utils/mailer');
        const { rows }   = await db.query("SELECT value FROM settings WHERE key = 'store_config'").catch(() => ({ rows: [] }));
        const storeCfg   = rows.length ? JSON.parse(rows[0].value) : {};
        const supportTo  = storeCfg.support_email || process.env.ADMIN_EMAIL || 'admin@siculera.it';

        await mailer.sendMail({
          to:      supportTo,
          subject: `💬 Chat Escalation — ${reason || 'Human support requested'}`,
          text:    `Session: ${session_token}\nReason: ${reason || 'Not specified'}\nMessage: ${msg || ''}\n\nView thread in the admin dashboard → AI Chat → Conversations.`
        });
      } catch (e) {
        console.error('[chat] escalation email error:', e.message);
      }

      return res.json({
        success:   true,
        escalated: true,
        message:   'Our support team has been notified and will be in touch shortly.'
      });
    } catch (err) {
      console.error('[chat] escalate error:', err);
      res.status(500).json({ error: 'Could not process escalation' });
    }
  },

  // ── Payment provider config (publishable keys for frontend) ──────────────────
  async paymentConfig(req, res) {
    return res.json({
      stripe_publishable_key: process.env.STRIPE_PUBLISHABLE_KEY || null,
      paypal_client_id:       process.env.PAYPAL_CLIENT_ID       || null
    });
  },

  // ── Stripe: create PaymentIntent ─────────────────────────────────────────────
  async stripeCreateIntent(req, res) {
    try {
      const { amount_cents, currency = 'eur', metadata = {} } = req.body || {};
      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey) return res.status(503).json({ error: 'Stripe is not configured.' });

      const stripe = require('stripe')(secretKey);
      const intent = await stripe.paymentIntents.create({
        amount:   amount_cents,
        currency,
        metadata,
        automatic_payment_methods: { enabled: true }
      });
      return res.json({ client_secret: intent.client_secret, intent_id: intent.id });
    } catch (err) {
      console.error('[chat] stripeCreateIntent error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  },

  // ── Stripe: confirm payment + create order ───────────────────────────────────
  async stripeConfirm(req, res) {
    try {
      const { intent_id, session_token, checkout_data: cd } = req.body || {};
      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey) return res.status(503).json({ error: 'Stripe is not configured.' });

      const stripe = require('stripe')(secretKey);
      const intent = await stripe.paymentIntents.retrieve(intent_id);
      if (intent.status !== 'succeeded') {
        return res.status(400).json({ error: `Payment not succeeded (status: ${intent.status})` });
      }

      // Payment confirmed — create the order
      const session = await sessionMgr.getSession(session_token);
      const config  = await loadChatConfig();
      const effectiveConfig = config || {};
      effectiveConfig.can_place_orders = true;
      const actions = [];

      const toolArgs = _buildToolArgs(cd);
      toolArgs.payment_method = 'stripe';

      const result = await dispatchTool('initiate_order', toolArgs, {
        session: session || { id: null, consent_given: false },
        config:  effectiveConfig,
        userId:  session?.user_id || null,
        guestEmail: cd.email,
        actions
      });

      return res.json({ success: true, order_number: result.order_number, total_eur: result.total_eur, actions });
    } catch (err) {
      console.error('[chat] stripeConfirm error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  },

  // ── PayPal: create order ──────────────────────────────────────────────────────
  async paypalCreateOrder(req, res) {
    try {
      const { amount_eur, currency = 'EUR' } = req.body || {};
      const clientId     = process.env.PAYPAL_CLIENT_ID;
      const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
      if (!clientId || !clientSecret) return res.status(503).json({ error: 'PayPal is not configured.' });

      // Get access token
      const tokenRes = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64') },
        body: 'grant_type=client_credentials'
      });
      const { access_token } = await tokenRes.json();

      const orderRes = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${access_token}` },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{ amount: { currency_code: currency, value: parseFloat(amount_eur).toFixed(2) } }]
        })
      });
      const order = await orderRes.json();
      return res.json({ paypal_order_id: order.id });
    } catch (err) {
      console.error('[chat] paypalCreateOrder error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  },

  // ── PayPal: capture payment + create order ───────────────────────────────────
  async paypalCapture(req, res) {
    try {
      const { paypal_order_id, session_token, checkout_data: cd } = req.body || {};
      const clientId     = process.env.PAYPAL_CLIENT_ID;
      const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
      if (!clientId || !clientSecret) return res.status(503).json({ error: 'PayPal is not configured.' });

      // Get access token
      const tokenRes = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64') },
        body: 'grant_type=client_credentials'
      });
      const { access_token } = await tokenRes.json();

      const captureRes = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${paypal_order_id}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${access_token}` }
      });
      const capture = await captureRes.json();
      if (capture.status !== 'COMPLETED') {
        return res.status(400).json({ error: `PayPal capture not completed (status: ${capture.status})` });
      }

      // Payment confirmed — create the order
      const session = await sessionMgr.getSession(session_token);
      const config  = await loadChatConfig();
      const effectiveConfig = config || {};
      effectiveConfig.can_place_orders = true;
      const actions = [];

      const toolArgs = _buildToolArgs(cd);
      toolArgs.payment_method = 'paypal';

      const result = await dispatchTool('initiate_order', toolArgs, {
        session: session || { id: null, consent_given: false },
        config:  effectiveConfig,
        userId:  session?.user_id || null,
        guestEmail: cd.email,
        actions
      });

      return res.json({ success: true, order_number: result.order_number, total_eur: result.total_eur, actions });
    } catch (err) {
      console.error('[chat] paypalCapture error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }
};

// ── Shared helper: build initiate_order tool args from checkout_data ─────────
function _buildToolArgs(cd) {
  return {
    items: cd.items.map(i => ({ slug: i.slug, quantity: i.quantity || 1 })),
    shipping_address: {
      full_name: `${cd.first_name} ${cd.last_name}`,
      address:   cd.street,
      city:      cd.city,
      postcode:  cd.postal,
      country:   cd.country,
      phone:     cd.phone
    },
    email:           cd.email,
    shipping_method: cd.shipping_method,
    shipping_cents:  cd.shipping_price != null ? Math.round(cd.shipping_price * 100) : null
  };
}

// ── Quick Reply Generator ─────────────────────────────────────────────────────

function buildQuickReplies(actions, reply = '') {
  const pills = [];
  const r     = (reply || '').toLowerCase();

  if (actions.some(a => a.type === 'add_to_cart')) {
    pills.push('View my cart');
    pills.push('Proceed to checkout');
  }
  if (r.includes('order') && r.includes('number')) {
    pills.push('Track another order');
  }
  if (r.includes('product') || r.includes('catalog')) {
    pills.push('See all products');
    pills.push('Show gift options');
  }
  if (r.includes('shipping') || r.includes('delivery')) {
    pills.push('View shipping rates');
  }
  if (pills.length === 0) {
    pills.push('Browse catalog', 'Check my order', 'Talk to a human');
  }

  return pills.slice(0, 4);
}

module.exports = chatController;
