'use strict';

const db = require('../models/db');
const {
  encryptValue,
  decryptValue,
  maskSecret,
  encryptSensitiveFields,
  decryptAndMaskFields,
  SENSITIVE_SUFFIXES
} = require('../utils/encryption');

/* ══════════════════════════════════════════════════════════════════════════════
   UTILITY
══════════════════════════════════════════════════════════════════════════════ */

/**
 * logAudit — insert a row into audit_log. Never throws.
 */
async function logAudit(adminId, action, entity, entityId, ip, details, dbConn) {
  const conn = dbConn || db;
  try {
    await conn.query(
      `INSERT INTO audit_log (admin_id, action, entity, entity_id, ip_address, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        adminId,
        action,
        entity   || null,
        entityId ? String(entityId) : null,
        ip       || null,
        details  ? JSON.stringify(details) : null
      ]
    );
  } catch (_) { /* audit failures must never break business requests */ }
}

// Encryption helpers are imported from shared utils/encryption.js above

/* ══════════════════════════════════════════════════════════════════════════════
   STATS
══════════════════════════════════════════════════════════════════════════════ */

async function getStats(req, res) {
  try {
    const [revenue, orders, customers, products, recentOrders, recentPayments] = await Promise.all([
      db.query(
        `SELECT COALESCE(SUM(p.amount_cents), 0) AS total
         FROM payments p WHERE p.status = 'succeeded'`
      ),
      db.query(`SELECT COUNT(*) FROM orders`),
      db.query(`SELECT COUNT(*) FROM users WHERE role = 'customer'`),
      db.query(`SELECT COUNT(*) FROM products WHERE is_active = true`),
      db.query(
        `SELECT o.id, o.order_number, o.status, o.total_cents, o.created_at,
                COALESCE(u.email, o.guest_email) AS email
         FROM orders o LEFT JOIN users u ON o.user_id = u.id
         ORDER BY o.created_at DESC LIMIT 5`
      ),
      db.query(
        `SELECT p.id, p.amount_cents, p.status, p.provider, p.created_at,
                o.order_number
         FROM payments p LEFT JOIN orders o ON p.order_id = o.id
         ORDER BY p.created_at DESC LIMIT 5`
      )
    ]);

    return res.json({
      total_revenue_cents:  parseInt(revenue.rows[0].total, 10),
      total_orders:         parseInt(orders.rows[0].count, 10),
      total_customers:      parseInt(customers.rows[0].count, 10),
      active_products:      parseInt(products.rows[0].count, 10),
      recent_orders:        recentOrders.rows,
      recent_payments:      recentPayments.rows
    });
  } catch (err) {
    console.error('[getStats]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   PRODUCTS
══════════════════════════════════════════════════════════════════════════════ */

async function listProducts(req, res) {
  try {
    const { rows } = await db.query('SELECT * FROM products ORDER BY created_at DESC');
    return res.json(rows);
  } catch (err) {
    console.error('[listProducts]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getProduct(req, res) {
  try {
    const { rows } = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('[getProduct]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function createProduct(req, res) {
  const {
    slug, name, description, flavour,
    price_cents, weight_grams, stock,
    is_active, is_giftable, image_url
  } = req.body;

  if (!slug || !name || price_cents == null) {
    return res.status(400).json({ error: 'slug, name, and price_cents are required' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO products
         (slug, name, description, flavour, price_cents, weight_grams,
          stock, is_active, is_giftable, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        slug, name,
        description  || null,
        flavour      || null,
        price_cents,
        weight_grams || 200,
        stock        ?? 0,
        is_active    !== false,
        is_giftable  !== false,
        image_url    || null
      ]
    );
    await logAudit(req.admin.id, 'create_product', 'products', rows[0].id, req.ip, { name });
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Slug already exists' });
    console.error('[createProduct]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateProduct(req, res) {
  const { id } = req.params;
  const ALLOWED = [
    'name','description','flavour','slug','price_cents',
    'weight_grams','stock','is_active','is_giftable','image_url'
  ];
  const sets = [];
  const vals = [];

  for (const field of ALLOWED) {
    if (req.body[field] !== undefined) {
      sets.push(`${field} = $${sets.length + 1}`);
      vals.push(req.body[field]);
    }
  }

  if (sets.length === 0) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  sets.push('updated_at = NOW()');
  vals.push(id);

  try {
    const { rows } = await db.query(
      `UPDATE products SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
    await logAudit(req.admin.id, 'update_product', 'products', id, req.ip, req.body);
    return res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Slug already exists' });
    console.error('[updateProduct]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteProduct(req, res) {
  const { id }        = req.params;
  const hardDelete    = req.query.hard === 'true';

  try {
    if (hardDelete) {
      await db.query('DELETE FROM products WHERE id = $1', [id]);
      await logAudit(req.admin.id, 'delete_product', 'products', id, req.ip, { hard: true });
      return res.json({ message: 'Product permanently deleted' });
    }
    // Soft delete (default)
    const { rows } = await db.query(
      `UPDATE products SET is_active = false, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
    await logAudit(req.admin.id, 'deactivate_product', 'products', id, req.ip, null);
    return res.json({ message: 'Product deactivated', product: rows[0] });
  } catch (err) {
    console.error('[deleteProduct]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   CUSTOMERS
══════════════════════════════════════════════════════════════════════════════ */

async function listCustomers(req, res) {
  const page   = Math.max(parseInt(req.query.page,  10) || 1, 1);
  const limit  = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const search = (req.query.search || '').trim();
  const offset = (page - 1) * limit;

  try {
    let whereClause = `WHERE u.role = 'customer'`;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (u.email ILIKE $${params.length}
        OR u.first_name ILIKE $${params.length}
        OR u.last_name  ILIKE $${params.length})`;
    }

    const listParams  = [...params, limit, offset];
    const countParams = [...params];

    const [data, countRes] = await Promise.all([
      db.query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.phone,
                u.created_at, u.is_verified,
                COUNT(DISTINCT o.id)::int AS order_count,
                COALESCE(
                  SUM(p.amount_cents) FILTER (WHERE p.status = 'succeeded'),
                  0
                )::int AS total_spent_cents
         FROM users u
         LEFT JOIN orders   o ON o.user_id = u.id
         LEFT JOIN payments p ON p.order_id = o.id
         ${whereClause}
         GROUP BY u.id
         ORDER BY u.created_at DESC
         LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams
      ),
      db.query(
        `SELECT COUNT(*) FROM users u ${whereClause}`,
        countParams
      )
    ]);

    return res.json({
      customers: data.rows,
      total:     parseInt(countRes.rows[0].count, 10),
      page,
      limit
    });
  } catch (err) {
    console.error('[listCustomers]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getCustomer(req, res) {
  const { id } = req.params;
  try {
    const [userRes, addressRes, ordersRes, spentRes] = await Promise.all([
      db.query(
        `SELECT id, email, first_name, last_name, phone, role,
                is_verified, created_at
         FROM users WHERE id = $1`,
        [id]
      ),
      db.query(
        'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC',
        [id]
      ),
      db.query(
        `SELECT o.id, o.order_number, o.status, o.total_cents, o.currency,
                o.created_at, o.carrier, o.tracking_number, o.shipping_method,
                (SELECT json_agg(oi.*)
                 FROM order_items oi WHERE oi.order_id = o.id) AS items
         FROM orders o WHERE o.user_id = $1 ORDER BY o.created_at DESC`,
        [id]
      ),
      db.query(
        `SELECT COALESCE(SUM(p.amount_cents), 0)::int AS total_spent_cents
         FROM payments p
         JOIN orders o ON p.order_id = o.id
         WHERE o.user_id = $1 AND p.status = 'succeeded'`,
        [id]
      )
    ]);

    if (!userRes.rows[0]) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    return res.json({
      ...userRes.rows[0],
      total_spent_cents: spentRes.rows[0].total_spent_cents,
      addresses:         addressRes.rows,
      orders:            ordersRes.rows
    });
  } catch (err) {
    console.error('[getCustomer]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function eraseCustomer(req, res) {
  const { id } = req.params;
  try {
    await db.query(
      `UPDATE users SET
         email        = 'erased_' || id || '@deleted',
         first_name   = '[Deleted]',
         last_name    = '[Deleted]',
         phone        = NULL,
         password_hash = 'ERASED',
         updated_at   = NOW()
       WHERE id = $1`,
      [id]
    );
    await db.query('DELETE FROM addresses WHERE user_id = $1', [id]);
    await logAudit(req.admin.id, 'gdpr_erasure', 'users', id, req.ip, null);
    return res.json({ message: 'Customer data erased (GDPR Art. 17)' });
  } catch (err) {
    console.error('[eraseCustomer]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function exportCustomerData(req, res) {
  const { id } = req.params;
  try {
    const [userRes, addressRes, ordersRes] = await Promise.all([
      db.query(
        `SELECT id, email, first_name, last_name, phone, created_at FROM users WHERE id = $1`,
        [id]
      ),
      db.query('SELECT * FROM addresses WHERE user_id = $1', [id]),
      db.query(
        `SELECT o.*,
                (SELECT json_agg(oi.*) FROM order_items oi WHERE oi.order_id = o.id) AS items
         FROM orders o WHERE o.user_id = $1 ORDER BY o.created_at DESC`,
        [id]
      )
    ]);

    if (!userRes.rows[0]) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    await logAudit(req.admin.id, 'gdpr_export', 'users', id, req.ip, null);

    return res.json({
      export_date: new Date().toISOString(),
      gdpr_basis:  'Article 20 — Right to Data Portability',
      customer:    userRes.rows[0],
      addresses:   addressRes.rows,
      orders:      ordersRes.rows
    });
  } catch (err) {
    console.error('[exportCustomerData]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   ORDERS
══════════════════════════════════════════════════════════════════════════════ */

async function listOrders(req, res) {
  const page   = Math.max(parseInt(req.query.page,  10) || 1, 1);
  const limit  = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const status = req.query.status || '';
  const offset = (page - 1) * limit;

  try {
    const params     = status ? [status, limit, offset] : [limit, offset];
    const whereClause = status ? 'WHERE o.status = $1' : '';
    const limitIdx   = status ? 2 : 1;
    const offsetIdx  = limitIdx + 1;

    const [data, countRes] = await Promise.all([
      db.query(
        `SELECT o.id, o.order_number, o.status, o.total_cents, o.currency,
                o.created_at, o.carrier, o.tracking_number,
                COALESCE(u.email, o.guest_email) AS customer_email,
                u.first_name, u.last_name,
                (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id)::int AS item_count,
                (SELECT p.status FROM payments p WHERE p.order_id = o.id
                 ORDER BY p.created_at DESC LIMIT 1) AS payment_status
         FROM orders o LEFT JOIN users u ON o.user_id = u.id
         ${whereClause}
         ORDER BY o.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params
      ),
      db.query(
        `SELECT COUNT(*) FROM orders o ${whereClause}`,
        status ? [status] : []
      )
    ]);

    return res.json({
      orders: data.rows,
      total:  parseInt(countRes.rows[0].count, 10),
      page,
      limit
    });
  } catch (err) {
    console.error('[listOrders]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getOrder(req, res) {
  const { id } = req.params;
  try {
    const [orderRes, itemsRes, paymentsRes, trackingRes] = await Promise.all([
      db.query(
        `SELECT o.*,
                COALESCE(u.email, o.guest_email) AS customer_email,
                u.first_name, u.last_name, u.phone
         FROM orders o LEFT JOIN users u ON o.user_id = u.id
         WHERE o.id = $1`,
        [id]
      ),
      db.query(
        'SELECT * FROM order_items WHERE order_id = $1 ORDER BY id',
        [id]
      ),
      db.query(
        'SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC',
        [id]
      ),
      db.query(
        `SELECT * FROM tracking_events WHERE order_id = $1 ORDER BY event_time DESC`,
        [id]
      )
    ]);

    if (!orderRes.rows[0]) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.json({
      ...orderRes.rows[0],
      items:          itemsRes.rows,
      payments:       paymentsRes.rows,
      tracking_events: trackingRes.rows
    });
  } catch (err) {
    console.error('[getOrder]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateOrderStatus(req, res) {
  const { id }     = req.params;
  const { status } = req.body;

  const VALID_STATUSES = ['pending','paid','processing','shipped','delivered','cancelled','refunded'];
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const sets  = ['status = $1', 'updated_at = NOW()'];
    const vals  = [status];

    if (status === 'shipped')   sets.push('shipped_at = NOW()');
    if (status === 'delivered') sets.push('delivered_at = NOW()');

    vals.push(id);

    const { rows } = await db.query(
      `UPDATE orders SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`,
      vals
    );

    if (!rows[0]) return res.status(404).json({ error: 'Order not found' });

    await logAudit(req.admin.id, 'update_order_status', 'orders', id, req.ip, { status });
    return res.json(rows[0]);
  } catch (err) {
    console.error('[updateOrderStatus]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateOrderTracking(req, res) {
  const { id }                         = req.params;
  const { carrier, tracking_number, tracking_url } = req.body;

  try {
    // Fetch current order status
    const current = await db.query('SELECT status FROM orders WHERE id = $1', [id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Order not found' });

    const autoShip = ['paid','processing'].includes(current.rows[0].status);

    const sets = [
      'carrier = $1',
      'tracking_number = $2',
      'tracking_url = $3',
      'updated_at = NOW()'
    ];
    const vals = [carrier, tracking_number, tracking_url || null];

    if (autoShip) {
      sets.push('status = $4', 'shipped_at = NOW()');
      vals.push('shipped');
    }

    vals.push(id);

    const { rows } = await db.query(
      `UPDATE orders SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`,
      vals
    );

    // Insert tracking event
    if (tracking_number) {
      await db.query(
        `INSERT INTO tracking_events
           (order_id, carrier, tracking_num, status, description, event_time)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [id, carrier, tracking_number, 'label_created', 'Shipping label created by admin']
      );
    }

    await logAudit(req.admin.id, 'update_order_tracking', 'orders', id, req.ip, {
      carrier, tracking_number, auto_shipped: autoShip
    });

    return res.json(rows[0]);
  } catch (err) {
    console.error('[updateOrderTracking]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   PAYMENTS
══════════════════════════════════════════════════════════════════════════════ */

async function listPaymentConfig(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT value FROM settings WHERE key = 'payment_config'`
    );
    if (!rows[0]) return res.json({});

    const config  = JSON.parse(rows[0].value);
    const masked  = decryptAndMaskFields(config);
    return res.json(masked);
  } catch (err) {
    console.error('[listPaymentConfig]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function savePaymentConfig(req, res) {
  try {
    const encrypted = encryptSensitiveFields(req.body);
    await db.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ('payment_config', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(encrypted)]
    );
    await logAudit(req.admin.id, 'save_payment_config', 'settings', 'payment_config', req.ip, null);
    return res.json({ message: 'Payment configuration saved' });
  } catch (err) {
    console.error('[savePaymentConfig]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function testPaymentProvider(req, res) {
  const { provider } = req.params;
  // Mock connectivity test — extend with real SDK calls per provider
  const supported = ['stripe', 'paypal', 'square'];
  if (!supported.includes(provider.toLowerCase())) {
    return res.status(400).json({ error: `Unknown provider: ${provider}` });
  }
  return res.json({
    provider,
    success: true,
    message: 'Connection test passed',
    tested_at: new Date().toISOString()
  });
}

async function listPaymentHistory(req, res) {
  const page     = Math.max(parseInt(req.query.page,  10) || 1, 1);
  const limit    = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const offset   = (page - 1) * limit;
  const from     = req.query.from     || null;
  const to       = req.query.to       || null;
  const provider = req.query.provider || null;
  const status   = req.query.status   || null;

  try {
    const conditions = [];
    const params     = [];

    if (from) {
      params.push(from);
      conditions.push(`p.created_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`p.created_at <= $${params.length}`);
    }
    if (provider) {
      params.push(provider);
      conditions.push(`p.provider = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`p.status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const listParams = [...params, limit, offset];

    const [data, countRes, sumRes] = await Promise.all([
      db.query(
        `SELECT p.id, p.order_id, p.amount_cents, p.currency, p.status,
                p.provider, p.payment_method, p.created_at,
                o.order_number,
                COALESCE(u.email, o.guest_email) AS customer_email,
                u.first_name, u.last_name
         FROM payments p
         LEFT JOIN orders o ON p.order_id = o.id
         LEFT JOIN users  u ON o.user_id  = u.id
         ${where}
         ORDER BY p.created_at DESC
         LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams
      ),
      db.query(`SELECT COUNT(*) FROM payments p ${where}`, params),
      db.query(
        `SELECT COALESCE(SUM(p.amount_cents), 0)::int AS total_succeeded
         FROM payments p ${where.replace(
           /WHERE/,
           `WHERE p.status = 'succeeded' ${conditions.length ? 'AND' : ''}`
         )}`,
        params
      )
    ]);

    return res.json({
      payments:              data.rows,
      total:                 parseInt(countRes.rows[0].count, 10),
      total_succeeded_cents: sumRes.rows[0].total_succeeded,
      page,
      limit
    });
  } catch (err) {
    console.error('[listPaymentHistory]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   SHIPPING
══════════════════════════════════════════════════════════════════════════════ */

async function getShippingConfig(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT value FROM settings WHERE key = 'shipping_config'`
    );
    if (!rows[0]) return res.json({});
    const config = JSON.parse(rows[0].value);
    return res.json(decryptAndMaskFields(config));
  } catch (err) {
    console.error('[getShippingConfig]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function saveShippingConfig(req, res) {
  try {
    const encrypted = encryptSensitiveFields(req.body);
    await db.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ('shipping_config', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(encrypted)]
    );
    await logAudit(req.admin.id, 'save_shipping_config', 'settings', 'shipping_config', req.ip, null);
    return res.json({ message: 'Shipping configuration saved' });
  } catch (err) {
    console.error('[saveShippingConfig]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function trackShipment(req, res) {
  const { carrier, number } = req.query;

  if (!carrier || !number) {
    return res.status(400).json({ error: 'carrier and number query parameters are required' });
  }

  const now = new Date();
  const yesterday = new Date(now - 86400000);

  // Mock tracking response — replace with real carrier API calls
  const mockEvents = {
    dhl: [
      { status: 'delivered',   description: 'Delivered to recipient',         location: 'Palermo, IT',   time: now.toISOString() },
      { status: 'out_for_del', description: 'Out for delivery',                location: 'Palermo, IT',   time: new Date(now - 3600000).toISOString() },
      { status: 'in_transit',  description: 'Arrived at destination facility', location: 'Rome Hub, IT',   time: yesterday.toISOString() }
    ],
    ups: [
      { status: 'in_transit',  description: 'Package in transit',              location: 'Milan Hub, IT',  time: now.toISOString() },
      { status: 'picked_up',   description: 'Picked up',                        location: 'Catania, IT',    time: yesterday.toISOString() }
    ],
    brt: [
      { status: 'in_transit',  description: 'Scansionato deposito BRT',         location: 'Napoli, IT',    time: now.toISOString() }
    ],
    gls: [
      { status: 'in_transit',  description: 'In transito presso deposito GLS', location: 'Bologna, IT',   time: now.toISOString() }
    ],
    sda: [
      { status: 'in_transit',  description: 'Pacco in lavorazione SDA',        location: 'Roma, IT',      time: now.toISOString() }
    ]
  };

  const key    = carrier.toLowerCase();
  const events = mockEvents[key] || [
    { status: 'unknown', description: 'No tracking data available', time: now.toISOString() }
  ];

  return res.json({
    carrier,
    tracking_number: number,
    events,
    mock: true
  });
}

/* ══════════════════════════════════════════════════════════════════════════════
   SECURITY & GDPR CONFIG
══════════════════════════════════════════════════════════════════════════════ */

async function getSecurityConfig(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT value FROM settings WHERE key = 'gdpr_config'`
    );
    return res.json(rows[0] ? JSON.parse(rows[0].value) : {});
  } catch (err) {
    console.error('[getSecurityConfig]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function saveSecurityConfig(req, res) {
  try {
    await db.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ('gdpr_config', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(req.body)]
    );
    await logAudit(req.admin.id, 'save_security_config', 'settings', 'gdpr_config', req.ip, null);
    return res.json({ message: 'Security / GDPR configuration saved' });
  } catch (err) {
    console.error('[saveSecurityConfig]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getAuditLog(req, res) {
  const action = req.query.action || null;
  const limit  = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const offset = (Math.max(parseInt(req.query.page, 10) || 1, 1) - 1) * limit;

  try {
    const params     = [];
    const conditions = [];

    if (action) {
      params.push(action);
      conditions.push(`al.action = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT al.id, al.action, al.entity, al.entity_id, al.ip_address,
              al.details, al.created_at,
              au.username AS admin_username, au.email AS admin_email
       FROM audit_log al
       LEFT JOIN admin_users au ON al.admin_id = au.id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json(rows);
  } catch (err) {
    console.error('[getAuditLog]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   GENERAL SETTINGS
══════════════════════════════════════════════════════════════════════════════ */

async function getSettings(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT value FROM settings WHERE key = 'store_config'`
    );
    return res.json(rows[0] ? JSON.parse(rows[0].value) : {});
  } catch (err) {
    console.error('[getSettings]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function saveSettings(req, res) {
  try {
    await db.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ('store_config', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(req.body)]
    );
    await logAudit(req.admin.id, 'save_store_settings', 'settings', 'store_config', req.ip, null);
    return res.json({ message: 'Store settings saved' });
  } catch (err) {
    console.error('[saveSettings]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* ── Product image upload ────────────────────────────────────────────────── */
async function uploadProductImage(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });
    const { id } = req.params;
    // Build the public URL for the uploaded file
    const imageUrl = `/uploads/products/${req.file.filename}`;
    const { rows } = await db.query(
      'UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, image_url',
      [imageUrl, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    await logAudit(req.admin.id, 'upload_product_image', 'product', id, req.ip, { image_url: imageUrl });
    return res.json({ id: rows[0].id, name: rows[0].name, image_url: imageUrl });
  } catch (err) {
    console.error('[uploadProductImage]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   EXPORTS  — canonical names match the new admin router
══════════════════════════════════════════════════════════════════════════════ */

module.exports = {
  // Stats
  getStats,

  // Products
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,

  // Customers
  listCustomers,
  getCustomer,
  eraseCustomer,
  exportCustomerData,

  // Orders
  listOrders,
  getOrder,
  updateOrderStatus,
  updateOrderTracking,

  // Payments
  listPaymentConfig,
  savePaymentConfig,
  testPaymentProvider,
  listPaymentHistory,

  // Shipping
  getShippingConfig,
  saveShippingConfig,
  trackShipment,

  // Security / GDPR
  getSecurityConfig,
  saveSecurityConfig,
  getAuditLog,

  // Settings
  getSettings,
  saveSettings,

  // ── Legacy aliases — keeps old admin.js route file working without changes ──
  getProducts:       listProducts,
  getCustomers:      listCustomers,
  exportCustomer:    exportCustomerData,
  getOrders:         listOrders,
  updateTracking:    updateOrderTracking,
  getPaymentHistory: listPaymentHistory,
  getPaymentConfig:  listPaymentConfig,
  getGdprConfig:     getSecurityConfig,
  saveGdprConfig:    saveSecurityConfig
};
