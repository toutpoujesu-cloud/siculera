'use strict';

const Order   = require('../models/Order');
const Product = require('../models/Product');
const db      = require('../models/db');
const mailer  = require('../utils/mailer');

/* ── Helpers ────────────────────────────────────────────────────────────── */

// Lazily initialise Stripe so we don't crash if the key is missing
let _stripe = null;
function getStripe() {
  if (!_stripe && process.env.STRIPE_SECRET_KEY) {
    _stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

// Read + decrypt payment config from settings table
async function getPaymentConfigRow() {
  try {
    const { rows } = await db.query("SELECT value FROM settings WHERE key = 'payment_config'");
    if (!rows.length) return null;
    return JSON.parse(rows[0].value);
  } catch (_) {
    return null;
  }
}

// Shipping: look up configured flat rate or free threshold
async function calcShipping(subtotal_cents) {
  try {
    const { rows } = await db.query("SELECT value FROM settings WHERE key = 'shipping_config'");
    if (!rows.length) return 600; // default €6
    const cfg = JSON.parse(rows[0].value);
    if (subtotal_cents >= (cfg.free_threshold_cents || 5000)) return 0;
    if (cfg.flat_rate && cfg.flat_rate.enabled) return cfg.flat_rate.price_cents || 600;
    return 600;
  } catch (_) {
    return 600;
  }
}

/* ── Controller ─────────────────────────────────────────────────────────── */

const orderController = {

  /* POST /api/orders
   * Accepts both checkout.html and legacy payloads.
   * When create_payment_intent=true: creates Stripe PaymentIntent and returns client_secret.
   */
  async create(req, res) {
    try {
      const {
        items,
        guest_email,
        address,
        shipping_cents: shippingOverride,
        shipping_method,
        is_gift,
        gift_message,
        notes,
        payment_method,
        promo_code,
        create_payment_intent,
        // Legacy fields sent by old checkout flows
        subtotal_cents: _sub,
        total_cents: _tot
      } = req.body;

      if (!items || !items.length) {
        return res.status(400).json({ error: 'No items provided' });
      }

      /* ── 1. Validate & enrich items ─────────────────────────────────── */
      const enriched = [];
      for (const item of items) {
        // Items sent from checkout.html may have no product_id (fallback products)
        if (item.product_id) {
          const product = await Product.findById(item.product_id);
          if (!product || !product.is_active) {
            return res.status(400).json({ error: `Product not found: ${item.product_id}` });
          }
          if (product.stock < item.quantity) {
            return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
          }
          enriched.push({
            product_id:       product.id,
            product_name:     product.name,
            quantity:         item.quantity,
            unit_price_cents: product.price_cents
          });
        } else {
          // Guest/fallback product — trust client price but cap at reasonable value
          const unitPrice = Math.min(Math.abs(item.unit_price_cents || 0), 100000);
          enriched.push({
            product_id:       null,
            product_name:     item.product_name || 'Siculera Product',
            quantity:         item.quantity,
            unit_price_cents: unitPrice
          });
        }
      }

      /* ── 2. Calculate totals ────────────────────────────────────────── */
      const subtotal_cents = enriched.reduce((s, i) => s + i.unit_price_cents * i.quantity, 0);
      const shipping       = typeof shippingOverride === 'number'
        ? shippingOverride
        : await calcShipping(subtotal_cents);
      const total_cents    = subtotal_cents + shipping;

      /* ── 3. Create order in DB ──────────────────────────────────────── */
      const order = await Order.create({
        user_id:        req.userId || null,
        guest_email:    guest_email || null,
        items:          enriched,
        shipping_cents: shipping,
        shipping_method: shipping_method || 'standard',
        is_gift:        is_gift || false,
        gift_message:   gift_message || null,
        notes:          notes || null,
        payment_method: payment_method || null
      });

      /* ── 4. Save shipping address ───────────────────────────────────── */
      if (address) {
        await db.query(
          `INSERT INTO order_addresses (order_id, full_name, line1, line2, city, postal_code, country, phone)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            order.id,
            address.full_name   || '',
            address.line1       || '',
            address.line2       || null,
            address.city        || '',
            address.postal_code || '',
            address.country     || 'IT',
            address.phone       || null
          ]
        );
      }

      /* ── 5. Optionally create Stripe PaymentIntent ──────────────────── */
      let client_secret = null;
      if (create_payment_intent && payment_method === 'stripe') {
        const stripe = getStripe();
        if (stripe && total_cents > 0) {
          const intent = await stripe.paymentIntents.create({
            amount:   total_cents,
            currency: 'eur',
            metadata: { order_id: order.id, order_number: order.order_number },
            receipt_email: guest_email || undefined
          });
          await Order.setStripePayment(order.id, intent.id, intent.client_secret);
          client_secret = intent.client_secret;
        }
      }

      /* ── 6. For non-Stripe methods mark order as pending ────────────── */
      if (payment_method === 'cash_on_delivery' || payment_method === 'bank_transfer') {
        // Order stays 'pending' — no further action needed
      }

      // ── 7. Send confirmation email (fire-and-forget) ────────────────── //
      if (guest_email) {
        mailer.sendOrderConfirmation({
          to:    guest_email,
          order: { ...order, total_cents, shipping_cents: shipping },
          items: enriched
        }).catch(err => console.warn('[mailer] Order email failed:', err.message));
      }

      res.status(201).json({
        id:           order.id,
        order_number: order.order_number,
        total_cents,
        client_secret: client_secret || undefined
      });

    } catch (err) {
      console.error('[orderController.create]', err);
      res.status(500).json({ error: err.message });
    }
  },

  async getOne(req, res) {
    try {
      const order = await Order.findById(req.params.id);
      if (!order) return res.status(404).json({ error: 'Order not found' });
      res.json(order);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getMyOrders(req, res) {
    try {
      const orders = await Order.findByUser(req.userId);
      res.json(orders);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async updateStatus(req, res) {
    try {
      const { status } = req.body;
      const order = await Order.updateStatus(req.params.id, status);
      if (!order) return res.status(404).json({ error: 'Order not found' });
      res.json(order);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
};

module.exports = orderController;
