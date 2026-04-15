const db = require('./db');

const User = {
  async findByEmail(email) {
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await db.query(
      'SELECT id, email, first_name, last_name, phone, role, is_verified, created_at FROM users WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  },

  async create({ email, password_hash, first_name, last_name, phone, role = 'customer' }) {
    const { rows } = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, role)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, email, first_name, last_name, role, created_at`,
      [email.toLowerCase(), password_hash, first_name, last_name, phone, role]
    );
    return rows[0];
  },

  async update(id, data) {
    const keys = Object.keys(data);
    const fields = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const { rows } = await db.query(
      `UPDATE users SET ${fields}, updated_at = NOW() WHERE id = $1 RETURNING id, email, first_name, last_name, phone, role`,
      [id, ...Object.values(data)]
    );
    return rows[0] || null;
  }
};

module.exports = User;
