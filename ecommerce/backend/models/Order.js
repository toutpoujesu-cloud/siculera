const db = require('./db');
const { v4: uuidv4 } = require('uuid');

function generateOrderNumber() {
  return 'SIC-' + Date.now().toString(36).toUpperCase() + '-' + uuidv4().slice(0, 4).toUpperCase();
}

const Order = {
  async create({ user_id, guest_email, items, shipping_cents = 0, shipping_method, is_gift, gift_message, notes, payment_method, currency = 'EUR' }) {
    const order_number = generateOrderNumber();
    const subtotal_cents = items.reduce((sum, i) => sum + i.unit_price_cents * i.quantity, 0);
    const total_cents = subtotal_cents + shipping_cents;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [order] } = await client.query(
        `INSERT INTO orders (order_number, user_id, guest_email, subtotal_cents, shipping_cents, total_cents, currency, shipping_method, is_gift, gift_message, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [order_number, user_id || null, guest_email || null, subtotal_cents, shipping_cents, total_cents, currency, shipping_method, is_gift || false, gift_message || null, notes || null]
      );
      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price_cents, total_cents)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [order.id, item.product_id, item.product_name, item.quantity, item.unit_price_cents, item.unit_price_cents * item.quantity]
        );
      }
      await client.query('COMMIT');
      return order;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async findById(id) {
    const { rows: [order] } = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (!order) return null;
    const { rows: items } = await db.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
    order.items = items;
    return order;
  },

  async findByUser(user_id) {
    const { rows } = await db.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [user_id]);
    return rows;
  },

  async updateStatus(id, status, extra = {}) {
    const updates = { status, ...extra };
    const keys = Object.keys(updates);
    const fields = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const { rows } = await db.query(
      `UPDATE orders SET ${fields}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...Object.values(updates)]
    );
    return rows[0] || null;
  },

  async setStripePayment(id, stripe_payment_id, stripe_client_secret) {
    const { rows } = await db.query(
      'UPDATE orders SET stripe_payment_id = $2, stripe_client_secret = $3, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id, stripe_payment_id, stripe_client_secret]
    );
    return rows[0] || null;
  },

  async findAll({ limit = 50, offset = 0 } = {}) {
    const { rows } = await db.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    return rows;
  }
};

module.exports = Order;
