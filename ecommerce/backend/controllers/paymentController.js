'use strict';

// Lazily init Stripe so missing key doesn't crash on startup
let _stripe = null;
function getStripe() {
  if (!_stripe && process.env.STRIPE_SECRET_KEY) {
    _stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

const Order  = require('../models/Order');
const db     = require('../models/db');
const mailer = require('../utils/mailer');

/* ── AES decrypt helper (mirrors adminController) ──────────────────────── */
const crypto = require('crypto');
function decrypt(encrypted) {
  try {
    const key = Buffer.from(process.env.DATA_ENCRYPTION_KEY || '', 'hex').slice(0, 32);
    const [ivHex, encHex] = encrypted.split(':');
    const iv  = Buffer.from(ivHex, 'hex');
    const enc = Buffer.from(encHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch (_) {
    return encrypted; // return as-is if not encrypted
  }
}

const paymentController = {

  /* GET /api/payments/config/public
   * Returns which methods are enabled + the Stripe publishable key (safe to expose).
   * Never exposes secret keys.
   */
  async getPublicConfig(req, res) {
    try {
      const { rows } = await db.query("SELECT value FROM settings WHERE key = 'payment_config'");
      if (!rows.length) {
        return res.json({ stripe: { enabled: false }, paypal: { enabled: false }, bank_transfer: { enabled: false }, cash_on_delivery: { enabled: false } });
      }
      const cfg = JSON.parse(rows[0].value);
      // Build safe public response
      const pub = {};
      for (const [provider, val] of Object.entries(cfg)) {
        pub[provider] = { enabled: !!val.enabled };
      }
      // Add Stripe publishable key (safe to expose to browser)
      if (pub.stripe && pub.stripe.enabled) {
        pub.stripe.publishable_key = process.env.STRIPE_PUBLISHABLE_KEY || '';
      }
      res.json(pub);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async createIntent(req, res) {
    try {
      const stripe = getStripe();
      if (!stripe) return res.status(503).json({ error: 'Stripe is not configured' });

      const { order_id } = req.body;
      const order = await Order.findById(order_id);
      if (!order) return res.status(404).json({ error: 'Order not found' });

      const intent = await stripe.paymentIntents.create({
        amount: order.total_cents,
        currency: (order.currency || 'EUR').toLowerCase(),
        metadata: { order_id: order.id, order_number: order.order_number }
      });

      await Order.setStripePayment(order.id, intent.id, intent.client_secret);
      res.json({ client_secret: intent.client_secret });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async webhook(req, res) {
    const stripe = getStripe();
    if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).json({ error: `Webhook error: ${err.message}` });
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const orderId = pi.metadata.order_id;
      if (orderId) {
        await Order.updateStatus(orderId, 'paid', { stripe_payment_id: pi.id });
        await db.query(
          `INSERT INTO payments (order_id, stripe_payment_id, amount_cents, currency, status, payment_method)
           VALUES ($1,$2,$3,$4,'succeeded',$5) ON CONFLICT (stripe_payment_id) DO NOTHING`,
          [orderId, pi.id, pi.amount, pi.currency.toUpperCase(), pi.payment_method_types?.[0] || 'card']
        );
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object;
      const orderId = pi.metadata.order_id;
      if (orderId) {
        await db.query(
          `INSERT INTO payments (order_id, stripe_payment_id, amount_cents, currency, status, error_message)
           VALUES ($1,$2,$3,$4,'failed',$5) ON CONFLICT (stripe_payment_id) DO NOTHING`,
          [orderId, pi.id, pi.amount, pi.currency.toUpperCase(), pi.last_payment_error?.message || 'Payment failed']
        );
      }
    }

    res.json({ received: true });
  },

  async wholesaleEnquiry(req, res) {
    try {
      const { full_name, business_name, email, phone, country, business_type, quantity_info, message } = req.body;
      if (!full_name || !business_name || !email) return res.status(400).json({ error: 'full_name, business_name, and email are required' });
      const { rows: [enquiry] } = await db.query(
        `INSERT INTO wholesale_enquiries (full_name, business_name, email, phone, country, business_type, quantity_info, message)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [full_name, business_name, email, phone, country, business_type, quantity_info, message]
      );
      // Send acknowledgement email (fire-and-forget)
      mailer.sendWholesaleAck({ to: email, full_name, business_name })
        .catch(e => console.warn('[mailer] Wholesale ack failed:', e.message));

      res.status(201).json({ success: true, enquiry });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async newsletter(req, res) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required' });
      const normalised = email.toLowerCase().trim();
      await db.query(
        'INSERT INTO newsletter_subscribers (email) VALUES ($1) ON CONFLICT (email) DO UPDATE SET is_active = TRUE',
        [normalised]
      );
      // Send welcome email (fire-and-forget)
      mailer.sendNewsletterWelcome({ to: normalised })
        .catch(e => console.warn('[mailer] Newsletter welcome failed:', e.message));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = paymentController;
