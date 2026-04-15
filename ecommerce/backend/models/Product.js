const db = require('./db');

const Product = {
  async findAll({ activeOnly = true } = {}) {
    const q = activeOnly
      ? 'SELECT * FROM products WHERE is_active = TRUE ORDER BY created_at ASC'
      : 'SELECT * FROM products ORDER BY created_at ASC';
    const { rows } = await db.query(q);
    return rows;
  },

  async findById(id) {
    const { rows } = await db.query('SELECT * FROM products WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async findBySlug(slug) {
    const { rows } = await db.query('SELECT * FROM products WHERE slug = $1', [slug]);
    return rows[0] || null;
  },

  async create(data) {
    const { slug, name, description, flavour, price_cents, weight_grams, stock, is_active, is_giftable, image_url } = data;
    const { rows } = await db.query(
      `INSERT INTO products (slug, name, description, flavour, price_cents, weight_grams, stock, is_active, is_giftable, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [slug, name, description, flavour, price_cents, weight_grams ?? 0, stock ?? 0, is_active ?? true, is_giftable ?? true, image_url ?? null]
    );
    return rows[0];
  },

  async update(id, data) {
    const keys = Object.keys(data);
    const fields = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const { rows } = await db.query(
      `UPDATE products SET ${fields}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...Object.values(data)]
    );
    return rows[0] || null;
  },

  async decrementStock(id, qty) {
    const { rows } = await db.query(
      'UPDATE products SET stock = stock - $2 WHERE id = $1 AND stock >= $2 RETURNING *',
      [id, qty]
    );
    return rows[0] || null;
  }
};

module.exports = Product;
