const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

const userController = {
  async register(req, res) {
    try {
      const { email, password, first_name, last_name, phone } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
      const existing = await User.findByEmail(email);
      if (existing) return res.status(409).json({ error: 'Email already registered' });
      const password_hash = await bcrypt.hash(password, 12);
      const user = await User.create({ email, password_hash, first_name, last_name, phone });
      res.status(201).json({ user, token: signToken(user) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;
      const user = await User.findByEmail(email);
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
      const { password_hash, ...safeUser } = user;
      res.json({ user: safeUser, token: signToken(user) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getMe(req, res) {
    try {
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async updateMe(req, res) {
    try {
      const allowed = ['first_name', 'last_name', 'phone'];
      const data = {};
      for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
      const user = await User.update(req.userId, data);
      res.json(user);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
};

module.exports = userController;
