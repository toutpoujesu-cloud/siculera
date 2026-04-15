'use strict';

/**
 * Siculera Mailer — thin wrapper around nodemailer.
 *
 * Configuration (in .env):
 *   SMTP_HOST       e.g. smtp.gmail.com
 *   SMTP_PORT       e.g. 587 (TLS) or 465 (SSL)
 *   SMTP_SECURE     'true' for SSL/port 465, leave blank for STARTTLS
 *   SMTP_USER       your email address
 *   SMTP_PASS       app password or SMTP password
 *   EMAIL_FROM      "Siculera <orders@siculera.it>"
 *
 * If SMTP_HOST is not set the mailer logs to console instead (dev mode).
 */

const nodemailer = require('nodemailer');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  if (!process.env.SMTP_HOST) {
    // Dev mode — log emails to console, never actually send
    _transporter = nodemailer.createTransport({ jsonTransport: true });
    return _transporter;
  }

  _transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  return _transporter;
}

const FROM = process.env.EMAIL_FROM || '"Siculera" <orders@siculera.it>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4000';

/* ── Order confirmation email ─────────────────────────────────────────────── */
async function sendOrderConfirmation({ to, order, items = [] }) {
  const itemsHtml = items.map(i => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #e8ddd0;font-family:Georgia,serif;font-size:15px;color:#27312a">${i.product_name}</td>
      <td style="padding:10px 0;border-bottom:1px solid #e8ddd0;text-align:center;color:#6b7a6c">${i.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #e8ddd0;text-align:right;font-family:Georgia,serif;color:#27312a">€${(i.unit_price_cents / 100).toFixed(2)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fbf7f1;font-family:'Inter',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fbf7f1;padding:48px 20px">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(39,49,42,.08)">

      <!-- Header -->
      <tr>
        <td style="background:#27312a;padding:32px 40px;text-align:center">
          <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;letter-spacing:.1em;color:#fbf7f1">Siculera</h1>
          <p style="margin:6px 0 0;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:rgba(251,247,241,.55)">Luxury Sicilian Pastry</p>
        </td>
      </tr>

      <!-- Body -->
      <tr><td style="padding:40px 40px 32px">
        <h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:22px;font-weight:400;color:#27312a">Your order is confirmed</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#6b7a6c">Thank you for your order. We're preparing it with care and will notify you when it ships.</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6efe3;border-radius:10px;padding:16px;margin-bottom:28px">
          <tr>
            <td style="font-size:13px;color:#6b7a6c;text-transform:uppercase;letter-spacing:.08em">Order Number</td>
            <td style="font-size:15px;font-family:Georgia,serif;color:#27312a;text-align:right;font-weight:600">${order.order_number}</td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
          <thead>
            <tr>
              <th style="text-align:left;padding-bottom:8px;border-bottom:2px solid #e8ddd0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7a6c;font-weight:500">Item</th>
              <th style="text-align:center;padding-bottom:8px;border-bottom:2px solid #e8ddd0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7a6c;font-weight:500">Qty</th>
              <th style="text-align:right;padding-bottom:8px;border-bottom:2px solid #e8ddd0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7a6c;font-weight:500">Price</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding-top:14px;font-size:13px;color:#6b7a6c">Shipping</td>
              <td style="padding-top:14px;text-align:right;font-family:Georgia,serif;color:#27312a">${order.shipping_cents === 0 ? 'Free' : '€' + (order.shipping_cents / 100).toFixed(2)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top:8px;font-size:16px;font-family:Georgia,serif;font-weight:600;color:#27312a;border-top:2px solid #e8ddd0;padding-top:12px;margin-top:8px">Total</td>
              <td style="padding-top:12px;border-top:2px solid #e8ddd0;text-align:right;font-family:Georgia,serif;font-size:18px;font-weight:600;color:#b8975a">€${(order.total_cents / 100).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        <p style="font-size:14px;color:#3c4a3f;line-height:1.7;margin:0 0 28px">
          If you have any questions about your order, simply reply to this email or visit our website.
        </p>

        <div style="text-align:center">
          <a href="${FRONTEND_URL}" style="display:inline-block;padding:14px 32px;background:#27312a;color:#fbf7f1;text-decoration:none;border-radius:999px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;font-weight:500">Continue Shopping</a>
        </div>
      </td></tr>

      <!-- Footer -->
      <tr>
        <td style="padding:24px 40px;border-top:1px solid #e8ddd0;text-align:center">
          <p style="margin:0;font-size:12px;color:#a8b4a9">© ${new Date().getFullYear()} Siculera — Luxury Sicilian Pastry</p>
          <p style="margin:6px 0 0;font-size:11px;color:#c0c8c0">
            You received this because you placed an order. Questions? <a href="mailto:hello@siculera.it" style="color:#b8975a">hello@siculera.it</a>
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  const info = await getTransporter().sendMail({
    from:    FROM,
    to,
    subject: `Order Confirmed — ${order.order_number} | Siculera`,
    html,
    text: `Your Siculera order ${order.order_number} is confirmed. Total: €${(order.total_cents / 100).toFixed(2)}`
  });

  if (!process.env.SMTP_HOST) {
    // Dev mode — print to console
    console.log('[mailer] Order confirmation email (dev mode):', JSON.parse(info.message).to, '| Subject:', JSON.parse(info.message).subject);
  }

  return info;
}

/* ── Wholesale enquiry acknowledgement ────────────────────────────────────── */
async function sendWholesaleAck({ to, full_name, business_name }) {
  const html = `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;background:#fbf7f1;padding:40px 20px">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:40px;box-shadow:0 8px 32px rgba(39,49,42,.08)">
  <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:400;color:#27312a">Siculera</h1>
  <h2 style="font-family:Georgia,serif;font-size:19px;font-weight:400;color:#27312a;margin-top:24px">Thank you, ${full_name}</h2>
  <p style="color:#6b7a6c;font-size:14px;line-height:1.7">We've received your wholesale enquiry for <strong>${business_name}</strong> and will be in touch within 2 business days.</p>
  <p style="color:#6b7a6c;font-size:14px">For urgent requests, contact us at <a href="mailto:wholesale@siculera.it" style="color:#b8975a">wholesale@siculera.it</a>.</p>
  <p style="color:#a8b4a9;font-size:12px;margin-top:32px">© ${new Date().getFullYear()} Siculera</p>
</div>
</body></html>`;

  return getTransporter().sendMail({
    from:    FROM,
    to,
    subject: 'Wholesale Enquiry Received — Siculera',
    html,
    text: `Dear ${full_name}, we received your wholesale enquiry for ${business_name} and will be in touch shortly.`
  });
}

/* ── Newsletter welcome ───────────────────────────────────────────────────── */
async function sendNewsletterWelcome({ to }) {
  const html = `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;background:#fbf7f1;padding:40px 20px">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:40px;box-shadow:0 8px 32px rgba(39,49,42,.08)">
  <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:400;color:#27312a">Siculera</h1>
  <h2 style="font-family:Georgia,serif;font-size:19px;font-weight:400;color:#27312a;margin-top:24px">Welcome to the Siculera community</h2>
  <p style="color:#6b7a6c;font-size:14px;line-height:1.7">You'll be the first to hear about new seasonal flavours, limited collections, and exclusive offers — delivered quietly, only when it matters.</p>
  <div style="text-align:center;margin-top:28px">
    <a href="${FRONTEND_URL}" style="display:inline-block;padding:14px 32px;background:#27312a;color:#fbf7f1;text-decoration:none;border-radius:999px;font-size:13px;letter-spacing:.08em;text-transform:uppercase">Explore the Collection</a>
  </div>
  <p style="color:#a8b4a9;font-size:11px;margin-top:32px">© ${new Date().getFullYear()} Siculera. You subscribed at siculera.it.</p>
</div>
</body></html>`;

  return getTransporter().sendMail({
    from:    FROM,
    to,
    subject: 'Welcome to Siculera — Seasonal stories & new flavours',
    html,
    text: `Welcome to Siculera. You'll be the first to hear about new seasonal flavours and limited collections.`
  });
}

module.exports = { sendOrderConfirmation, sendWholesaleAck, sendNewsletterWelcome };
