'use strict';

/**
 * Siculera AI Chat — Tool Definitions & Dispatcher
 *
 * All 10 tools the AI assistant can call.
 * Each entry: { name, description, parameters } (OpenAI-canonical format)
 *
 * dispatchTool(name, args, context) → result object
 *
 * context = { session, config, userId, guestEmail, req }
 */

const db      = require('../models/db');
const Product = require('../models/Product');
const Order   = require('../models/Order');
const rag     = require('./ragSearch');
const { escalateSession } = require('./sessionManager');

// ── Fallback catalog (used when DB is unavailable) ───────────────────────────
const FALLBACK_PRODUCTS = [
  {
    slug: 'pasta-di-pistacchio-bronte',
    name: 'Pasta di Pistacchio di Bronte',
    description: 'Pure pistachio paste from Bronte DOP pistachios. Intensely flavoured — ideal for pastries, gelato and gourmet spreads.',
    flavour: 'pistachio',
    price_eur: '24.90',
    weight_g: 200,
    in_stock: true,
    stock_qty: 50,
    giftable: true
  },
  {
    slug: 'pasta-di-mandorla-avola',
    name: 'Pasta di Mandorla di Avola',
    description: 'Velvety almond paste crafted from prized Avola almonds. Sweet, rich and perfect for traditional Sicilian confections.',
    flavour: 'almond',
    price_eur: '18.90',
    weight_g: 200,
    in_stock: true,
    stock_qty: 40,
    giftable: true
  },
  {
    slug: 'torrone-al-pistacchio',
    name: 'Torrone al Pistacchio',
    description: 'Artisanal soft nougat generously studded with whole Bronte pistachios. A beloved Sicilian holiday confection.',
    flavour: 'pistachio nougat',
    price_eur: '16.50',
    weight_g: 150,
    in_stock: true,
    stock_qty: 30,
    giftable: true
  },
  {
    slug: 'amaretti-di-mandorla',
    name: 'Amaretti di Mandorla',
    description: 'Light, crisp almond macaroons with a delicate bitter-sweet flavour. Made with the finest Sicilian almonds.',
    flavour: 'almond',
    price_eur: '12.90',
    weight_g: 180,
    in_stock: true,
    stock_qty: 60,
    giftable: true
  },
  {
    slug: 'cubbaita-mandorle-sesamo',
    name: 'Cubbaita — Almond & Sesame Brittle',
    description: 'A crunchy Sicilian brittle of toasted almonds and sesame seeds in golden honey. An ancient Arab-Sicilian delicacy.',
    flavour: 'almond sesame',
    price_eur: '9.90',
    weight_g: 120,
    in_stock: true,
    stock_qty: 45,
    giftable: false
  },
  {
    slug: 'frutta-martorana',
    name: 'Frutta Martorana',
    description: 'Hand-painted marzipan shaped into lifelike Sicilian fruits. A masterpiece of Palermo pastry art — the perfect gift.',
    flavour: 'marzipan almond',
    price_eur: '22.50',
    weight_g: 250,
    in_stock: true,
    stock_qty: 20,
    giftable: true
  }
];

// ── Tool Definitions (passed to the LLM) ────────────────────────────────────

const TOOL_DEFINITIONS = [
  {
    name: 'get_products',
    description: 'List available products from the Siculera catalog. Use this when the customer asks what products are available, wants to browse, or asks about specific categories or price ranges. Returns name, price, description, flavour, stock status.',
    parameters: {
      type: 'object',
      properties: {
        flavour:   { type: 'string', description: 'Filter by flavour keyword e.g. "pistachio", "almond", "hazelnut"' },
        max_price: { type: 'number', description: 'Maximum price in EUR (e.g. 25)' },
        giftable:  { type: 'boolean', description: 'Set true to show only gift-suitable products' },
        limit:     { type: 'integer', description: 'Max results to return (default 8)' }
      },
      required: []
    }
  },
  {
    name: 'get_product_details',
    description: 'Get full details for a single product by its slug or name. Use this when the customer asks about a specific product — ingredients, weight, allergens, price, stock, giftability.',
    parameters: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Product slug e.g. "pistachio-almond-paste"' }
      },
      required: ['slug']
    }
  },
  {
    name: 'check_order_status',
    description: 'Look up an order by order number and the customer email address. Use this when the customer wants to know the status or tracking of their order. Always require both order_number and email for security.',
    parameters: {
      type: 'object',
      properties: {
        order_number: { type: 'string', description: 'Order number e.g. "SIC-ABC123"' },
        email:        { type: 'string', description: 'Email address used when placing the order' }
      },
      required: ['order_number', 'email']
    }
  },
  {
    name: 'add_to_cart',
    description: 'Add a product to the customer\'s cart. Use this when the customer explicitly asks to add an item. Always verify stock first. Returns an action that the widget will execute on the host page.',
    parameters: {
      type: 'object',
      properties: {
        slug:     { type: 'string',  description: 'Product slug to add' },
        quantity: { type: 'integer', description: 'Quantity to add (default 1)', default: 1 }
      },
      required: ['slug']
    }
  },
  {
    name: 'initiate_order',
    description: 'Place an order on behalf of the customer. Only use when the customer explicitly confirms they want to order. Only supports bank_transfer or cash_on_delivery — for card payments direct them to the checkout page. Requires full shipping details.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'List of items to order',
          items: {
            type: 'object',
            properties: {
              slug:     { type: 'string' },
              quantity: { type: 'integer' }
            },
            required: ['slug', 'quantity']
          }
        },
        shipping_address: {
          type: 'object',
          properties: {
            full_name: { type: 'string' },
            address:   { type: 'string' },
            city:      { type: 'string' },
            postcode:  { type: 'string' },
            country:   { type: 'string', default: 'IT' }
          },
          required: ['full_name', 'address', 'city', 'postcode']
        },
        email: {
          type: 'string',
          description: 'Customer email for order confirmation'
        },
        payment_method: {
          type: 'string',
          enum: ['bank_transfer', 'cash_on_delivery'],
          description: 'Payment method — card payments must use the checkout page'
        },
        is_gift:      { type: 'boolean',  description: 'Is this a gift?' },
        gift_message: { type: 'string',   description: 'Optional gift message (max 500 chars)' },
        notes:        { type: 'string',   description: 'Delivery notes' }
      },
      required: ['items', 'shipping_address', 'email', 'payment_method']
    }
  },
  {
    name: 'get_shipping_options',
    description: 'Get available shipping methods and rates. Use when the customer asks about delivery costs, times, or available couriers.',
    parameters: {
      type: 'object',
      properties: {
        country: { type: 'string', description: 'Destination country code (ISO 3166-1 alpha-2)' },
        subtotal_eur: { type: 'number', description: 'Order subtotal in EUR to check free-shipping eligibility' }
      },
      required: []
    }
  },
  {
    name: 'request_gdpr_data_export',
    description: 'Submit a GDPR Article 15 data access request on behalf of the logged-in customer. This will send an email to the admin with the request. Only available for authenticated users.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Optional reason stated by the customer' }
      },
      required: []
    }
  },
  {
    name: 'request_gdpr_erasure',
    description: 'Submit a GDPR Article 17 right-to-erasure request on behalf of the logged-in customer. This creates a human-review request (does NOT auto-delete) and emails the admin. Only for authenticated users.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Reason stated by the customer for the erasure request' }
      },
      required: []
    }
  },
  {
    name: 'search_knowledge_base',
    description: 'Search the Siculera knowledge base (uploaded documents) for information about products, allergens, company policies, shipping terms, certifications, or any other topic not covered by a specific tool.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query keywords' },
        limit: { type: 'integer', description: 'Max results (default 5)', default: 5 }
      },
      required: ['query']
    }
  },
  {
    name: 'escalate_to_human',
    description: 'Escalate the conversation to a human support agent. Use this when the customer explicitly asks to speak to a human, when you cannot resolve their issue, or when the situation requires human judgment (complaints, complex refunds, etc.).',
    parameters: {
      type: 'object',
      properties: {
        reason:  { type: 'string', description: 'Brief reason for escalation' },
        message: { type: 'string', description: 'Message to pass to the human agent' }
      },
      required: ['reason']
    }
  },
  {
    name: 'show_cart',
    description: 'Display the customer\'s current cart visually in the chat widget. Use this when the customer asks to see their cart, what\'s in their basket, or wants a summary of what they\'re buying.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

// ── Tool Filtering by Capability Flags ───────────────────────────────────────

/**
 * Return the subset of tool definitions allowed by the current config.
 * @param {object} config - ai_chat_config from settings
 */
function getEnabledTools(config = {}) {
  return TOOL_DEFINITIONS.filter(t => {
    if (t.name === 'initiate_order')          return config.can_place_orders  !== false && config.can_place_orders;
    if (t.name === 'request_gdpr_data_export') return config.can_handle_gdpr  !== false && config.can_handle_gdpr;
    if (t.name === 'request_gdpr_erasure')     return config.can_handle_gdpr  !== false && config.can_handle_gdpr;
    return true; // all other tools always enabled
  });
}

// ── Shipping helper ───────────────────────────────────────────────────────────

async function getShippingConfig() {
  try {
    const { rows } = await db.query("SELECT value FROM settings WHERE key = 'shipping_config'");
    if (!rows.length) return null;
    return JSON.parse(rows[0].value);
  } catch { return null; }
}

async function calcShippingCents(subtotalCents) {
  const cfg = await getShippingConfig();
  if (!cfg) return 600;
  if (subtotalCents >= (cfg.free_threshold_cents || 5000)) return 0;
  if (cfg.flat_rate?.enabled) return cfg.flat_rate.price_cents || 600;
  return 600;
}

// ── Mailer helper (lazy load) ─────────────────────────────────────────────────

let _mailer = null;
function getMailer() {
  if (!_mailer) _mailer = require('./mailer');
  return _mailer;
}

// ── Tool Dispatcher ──────────────────────────────────────────────────────────

/**
 * Execute a tool call and return the result.
 *
 * @param {string} toolName
 * @param {object} args
 * @param {object} context   - { session, config, userId, guestEmail, actions }
 * @returns {Promise<object>} - Tool result (will be JSON-stringified for LLM)
 */
async function dispatchTool(toolName, args, context = {}) {
  const { session, config = {}, userId, guestEmail, actions = [] } = context;

  try {
    switch (toolName) {

      // ── 1. get_products ──────────────────────────────────────────────────
      case 'get_products': {
        let products;

        try {
          let query = 'SELECT id, slug, name, description, flavour, price_cents, weight_grams, stock, is_giftable, image_url FROM products WHERE is_active = TRUE';
          const params = [];

          if (args.flavour) {
            params.push(`%${args.flavour}%`);
            query += ` AND (flavour ILIKE $${params.length} OR name ILIKE $${params.length} OR description ILIKE $${params.length})`;
          }
          if (args.max_price != null) {
            params.push(Math.round(args.max_price * 100));
            query += ` AND price_cents <= $${params.length}`;
          }
          if (args.giftable) {
            query += ' AND is_giftable = TRUE';
          }
          const limit = Math.min(args.limit || 8, 20);
          params.push(limit);
          query += ` ORDER BY price_cents ASC LIMIT $${params.length}`;

          const { rows } = await db.query(query, params);
          products = rows.map(p => ({
            slug:        p.slug,
            name:        p.name,
            description: p.description,
            flavour:     p.flavour,
            price_eur:   (p.price_cents / 100).toFixed(2),
            weight_g:    p.weight_grams,
            in_stock:    p.stock > 0,
            stock_qty:   p.stock,
            giftable:    p.is_giftable,
            image_url:   p.image_url || null
          }));
        } catch (_dbErr) {
          // DB unavailable — filter the in-memory fallback catalog
          let fb = FALLBACK_PRODUCTS.slice();
          if (args.flavour) {
            const kw = args.flavour.toLowerCase();
            fb = fb.filter(p =>
              (p.flavour + ' ' + p.name + ' ' + p.description).toLowerCase().includes(kw)
            );
          }
          if (args.max_price != null) {
            fb = fb.filter(p => parseFloat(p.price_eur) <= args.max_price);
          }
          if (args.giftable) {
            fb = fb.filter(p => p.giftable);
          }
          products = fb.slice(0, Math.min(args.limit || 8, 20));
        }

        // Push a show_products action so the widget renders product cards
        if (actions && products.length) {
          actions.push({ type: 'show_products', products });
        }

        return { products, count: products.length };
      }

      // ── 2. get_product_details ───────────────────────────────────────────
      case 'get_product_details': {
        const product = await Product.findBySlug(args.slug);
        if (!product) return { error: `Product "${args.slug}" not found.` };
        return {
          slug:        product.slug,
          name:        product.name,
          description: product.description,
          flavour:     product.flavour,
          price_eur:   (product.price_cents / 100).toFixed(2),
          weight_g:    product.weight_grams,
          in_stock:    product.stock > 0,
          stock_qty:   product.stock,
          giftable:    product.is_giftable,
          image_url:   product.image_url
        };
      }

      // ── 3. check_order_status ────────────────────────────────────────────
      case 'check_order_status': {
        const { order_number, email } = args;
        if (!order_number || !email) {
          return { error: 'Both order_number and email are required to look up an order.' };
        }

        let orderData;
        try {
          const { rows } = await db.query(
            `SELECT o.order_number, o.status, o.total_cents, o.currency,
                    o.created_at, o.shipping_method, o.tracking_number,
                    o.guest_email, u.email AS user_email
             FROM orders o
             LEFT JOIN users u ON o.user_id = u.id
             WHERE o.order_number = $1
               AND (LOWER(o.guest_email) = LOWER($2) OR LOWER(u.email) = LOWER($2))
             LIMIT 1`,
            [order_number, email]
          );

          if (!rows.length) {
            return { error: 'No order found with that order number and email combination. Please check the details and try again.' };
          }

          const o = rows[0];
          orderData = {
            order_number:    o.order_number,
            status:          o.status,
            total_eur:       (o.total_cents / 100).toFixed(2),
            currency:        o.currency,
            placed_at:       o.created_at,
            shipping_method: o.shipping_method,
            tracking_number: o.tracking_number || null
          };
        } catch (_dbErr) {
          return { error: 'Order lookup is temporarily unavailable. Please try again shortly or contact support.' };
        }

        // Push show_order action so the widget renders a visual order card
        if (actions && orderData) {
          actions.push({ type: 'show_order', order: orderData });
        }

        return orderData;
      }

      // ── 3b. show_cart ────────────────────────────────────────────────────
      case 'show_cart': {
        // Widget reads cart from localStorage — just push the action
        actions.push({ type: 'show_cart' });
        return { success: true, message: 'Cart displayed in the widget.' };
      }

      // ── 4. add_to_cart ───────────────────────────────────────────────────
      case 'add_to_cart': {
        let product = null;
        try {
          product = await Product.findBySlug(args.slug);
        } catch (_) {}

        // Fallback to in-memory catalog when DB is unavailable
        if (!product) {
          const fb = FALLBACK_PRODUCTS.find(p => p.slug === args.slug);
          if (fb) {
            product = {
              slug:        fb.slug,
              name:        fb.name,
              stock:       fb.in_stock ? 99 : 0,
              price_cents: Math.round(parseFloat(fb.price_eur) * 100)
            };
          }
        }

        if (!product) return { error: `Product "${args.slug}" not found.` };
        if (product.stock < 1) return { error: `Sorry, "${product.name}" is currently out of stock.` };

        const qty = Math.max(1, parseInt(args.quantity) || 1);

        const priceEur = (product.price_cents / 100);

        // Push action for the widget to execute (includes name + price so widget can write to localStorage)
        actions.push({
          type:      'add_to_cart',
          slug:      product.slug,
          name:      product.name,
          price:     priceEur,
          quantity:  qty,
          image_url: product.image_url || null
        });

        return {
          success:   true,
          product:   product.name,
          quantity:  qty,
          price_eur: priceEur.toFixed(2),
          message:   `Added ${qty}× ${product.name} to your cart.`
        };
      }

      // ── 5. initiate_order ────────────────────────────────────────────────
      case 'initiate_order': {
        if (!config.can_place_orders) {
          return { error: 'Order placement via chat is not enabled. Please use the checkout page.' };
        }
        if (!['bank_transfer', 'cash_on_delivery'].includes(args.payment_method)) {
          return { error: 'Only bank_transfer and cash_on_delivery are accepted via chat. For card payments, please visit the checkout page.' };
        }

        // Resolve products — with fallback to FALLBACK_PRODUCTS when DB is unavailable
        const resolvedItems = [];
        for (const item of (args.items || [])) {
          let product = null;
          try { product = await Product.findBySlug(item.slug); } catch (_) {}
          if (!product) {
            const fb = FALLBACK_PRODUCTS.find(p => p.slug === item.slug);
            if (fb) {
              product = { id: null, slug: fb.slug, name: fb.name, stock: 99, price_cents: Math.round(parseFloat(fb.price_eur) * 100) };
            }
          }
          if (!product) return { error: `Product "${item.slug}" not found.` };
          resolvedItems.push({
            product_id:       product.id,
            product_name:     product.name,
            quantity:         item.quantity || 1,
            unit_price_cents: product.price_cents
          });
        }

        const subtotal_cents = resolvedItems.reduce((s, i) => s + i.unit_price_cents * i.quantity, 0);
        let shipping_cents = 600; // default €6
        if (args.shipping_cents != null) {
          shipping_cents = Math.round(args.shipping_cents);
        } else {
          try { shipping_cents = await calcShippingCents(subtotal_cents); } catch (_) {}
        }

        const addr = args.shipping_address || {};
        const notes = [
          `Name: ${addr.full_name || ''}`,
          `Address: ${addr.address || ''}, ${addr.city || ''} ${addr.postcode || ''}, ${addr.country || 'IT'}`,
          args.notes || ''
        ].filter(Boolean).join(' | ');

        // Generate order number fallback when DB is unavailable
        let order = null;
        try {
          order = await Order.create({
            user_id:         userId || null,
            guest_email:     args.email,
            items:           resolvedItems,
            shipping_cents,
            shipping_method: args.shipping_method || 'standard',
            is_gift:         args.is_gift || false,
            gift_message:    args.gift_message || null,
            notes,
            payment_method:  args.payment_method,
            currency:        'EUR'
          });
        } catch (_) {
          // DB unavailable — generate temp order reference
          const ts = Date.now().toString(36).toUpperCase();
          order = {
            order_number: `SIC-${ts}`,
            total_cents:  subtotal_cents + shipping_cents,
            shipping_cents,
            id: null
          };
        }

        // Link order to chat session
        if (session?.id) {
          await db.query(
            'INSERT INTO chat_orders (session_id, order_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [session.id, order.id]
          ).catch(() => {});
        }

        // Send confirmation email
        try {
          const mailer = getMailer();
          await mailer.sendOrderConfirmation({
            email:        args.email,
            order_number: order.order_number,
            items:        resolvedItems,
            total_cents:  order.total_cents,
            payment_method: args.payment_method
          });
        } catch (e) {
          console.error('[chatTools] order email error:', e.message);
        }

        actions.push({
          type:           'show_order_confirmation',
          order_number:   order.order_number,
          total_eur:      (order.total_cents / 100).toFixed(2),
          shipping_eur:   (order.shipping_cents / 100).toFixed(2),
          payment_method: args.payment_method,
          email:          args.email,
          items:          resolvedItems.map(i => ({ name: i.product_name, quantity: i.quantity, unit_price: (i.unit_price_cents / 100).toFixed(2) }))
        });

        return {
          success:          true,
          order_number:     order.order_number,
          total_eur:        (order.total_cents / 100).toFixed(2),
          shipping_eur:     (order.shipping_cents / 100).toFixed(2),
          payment_method:   args.payment_method,
          message:          `Order ${order.order_number} placed successfully! A confirmation has been sent to ${args.email}.`
        };
      }

      // ── 6. get_shipping_options ──────────────────────────────────────────
      case 'get_shipping_options': {
        const cfg = await getShippingConfig();
        if (!cfg) {
          return {
            options: [{ name: 'Standard', price_eur: '6.00', estimated_days: '3-5' }],
            free_threshold_eur: '50.00',
            note: 'Default shipping rates apply.'
          };
        }

        const subtotalCents = args.subtotal_eur ? Math.round(args.subtotal_eur * 100) : 0;
        const freeThreshold = cfg.free_threshold_cents || 5000;
        const options = [];

        if (cfg.flat_rate?.enabled) {
          options.push({
            name:            cfg.flat_rate.label || 'Standard Shipping',
            price_eur:       subtotalCents >= freeThreshold ? '0.00' : ((cfg.flat_rate.price_cents || 600) / 100).toFixed(2),
            estimated_days:  cfg.flat_rate.days || '3-5',
            free_if_over:    (freeThreshold / 100).toFixed(2)
          });
        }

        // Add courier options if configured
        const couriers = ['dhl', 'ups', 'brt', 'gls', 'sda'];
        for (const c of couriers) {
          if (cfg[c]?.enabled) {
            options.push({
              name:           cfg[c].label || c.toUpperCase(),
              price_eur:      ((cfg[c].price_cents || 800) / 100).toFixed(2),
              estimated_days: cfg[c].days || '1-3'
            });
          }
        }

        if (!options.length) {
          options.push({ name: 'Standard', price_eur: '6.00', estimated_days: '3-5' });
        }

        return {
          options,
          free_threshold_eur: (freeThreshold / 100).toFixed(2),
          qualifies_for_free: subtotalCents >= freeThreshold
        };
      }

      // ── 7. request_gdpr_data_export ──────────────────────────────────────
      case 'request_gdpr_data_export': {
        if (!userId) {
          return { error: 'GDPR data requests require you to be logged in. Please sign in first.' };
        }

        // Log to audit log
        await db.query(
          `INSERT INTO audit_log (admin_id, action, target_type, target_id, details)
           VALUES (NULL, 'chat_gdpr_export_request', 'user', $1, $2)`,
          [userId, JSON.stringify({ reason: args.reason || '', via: 'chat' })]
        ).catch(() => {});

        // Email admin
        try {
          const mailer = getMailer();
          const adminEmail = process.env.ADMIN_EMAIL || 'admin@siculera.it';
          await mailer.sendMail({
            to:      adminEmail,
            subject: `GDPR Data Export Request — User ${userId}`,
            text:    `A customer (user_id: ${userId}) has requested their data via AI chat.\nReason: ${args.reason || 'Not stated'}\nPlease process within 30 days as per GDPR Article 15.`
          });
        } catch (e) {
          console.error('[chatTools] GDPR export email error:', e.message);
        }

        return {
          success: true,
          message: 'Your data access request has been submitted. Our team will process it within 30 days as required by GDPR Article 15 and contact you at your registered email address.'
        };
      }

      // ── 8. request_gdpr_erasure ──────────────────────────────────────────
      case 'request_gdpr_erasure': {
        if (!userId) {
          return { error: 'GDPR erasure requests require you to be logged in. Please sign in first.' };
        }

        // Log to audit log — human review only, no auto-delete
        await db.query(
          `INSERT INTO audit_log (admin_id, action, target_type, target_id, details)
           VALUES (NULL, 'chat_gdpr_erasure_request', 'user', $1, $2)`,
          [userId, JSON.stringify({ reason: args.reason || '', via: 'chat', status: 'pending_human_review' })]
        ).catch(() => {});

        // Email admin
        try {
          const mailer = getMailer();
          const adminEmail = process.env.ADMIN_EMAIL || 'admin@siculera.it';
          await mailer.sendMail({
            to:      adminEmail,
            subject: `⚠️ GDPR Erasure Request — User ${userId}`,
            text:    `A customer (user_id: ${userId}) has requested account erasure via AI chat.\nReason: ${args.reason || 'Not stated'}\n\nIMPORTANT: This requires human review before any action is taken. Please log in to the admin dashboard to process this request within 30 days (GDPR Article 17).`
          });
        } catch (e) {
          console.error('[chatTools] GDPR erasure email error:', e.message);
        }

        return {
          success: true,
          message: 'Your erasure request has been received and flagged for human review. Our team will contact you within 30 days. Note: some data may be retained for legal obligations (e.g. order records, tax compliance) under GDPR Article 17(3).'
        };
      }

      // ── 9. search_knowledge_base ─────────────────────────────────────────
      case 'search_knowledge_base': {
        const { query, limit } = args;
        if (!query) return { error: 'Search query is required.' };

        const language = config.tsvector_language || 'english';
        const chunks   = await rag.search(query, { limit: limit || config.max_rag_chunks || 5, language });

        if (!chunks.length) {
          return { found: false, message: 'No relevant information found in the knowledge base for that query.' };
        }

        return {
          found:   true,
          results: chunks.map(c => ({ source: c.document_name, content: c.content }))
        };
      }

      // ── 10. escalate_to_human ────────────────────────────────────────────
      case 'escalate_to_human': {
        if (session?.id) {
          await escalateSession(session.id, args.reason || '');
        }

        // Email support
        try {
          const mailer     = getMailer();
          const { rows }   = await db.query("SELECT value FROM settings WHERE key = 'store_config'").catch(() => ({ rows: [] }));
          const storeCfg   = rows.length ? JSON.parse(rows[0].value) : {};
          const supportTo  = storeCfg.support_email || process.env.ADMIN_EMAIL || 'admin@siculera.it';

          await mailer.sendMail({
            to:      supportTo,
            subject: `💬 Chat Escalation — ${args.reason || 'Customer requested human support'}`,
            text:    [
              `A customer has requested human assistance via the AI chat.`,
              `Session: ${session?.session_token || 'unknown'}`,
              `Reason: ${args.reason || 'Not specified'}`,
              `Message: ${args.message || ''}`,
              `\nPlease log in to the admin dashboard → AI Chat → Conversations to view the full thread.`
            ].join('\n')
          });
        } catch (e) {
          console.error('[chatTools] escalation email error:', e.message);
        }

        actions.push({ type: 'show_human_contact' });

        return {
          success:  true,
          escalated: true,
          message:  'I\'ve notified our support team and they will be in touch shortly. Is there anything else I can help you with in the meantime?'
        };
      }

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    console.error(`[chatTools] dispatchTool(${toolName}) error:`, err.message);
    return { error: `Tool execution failed: ${err.message}` };
  }
}

module.exports = { TOOL_DEFINITIONS, getEnabledTools, dispatchTool };
