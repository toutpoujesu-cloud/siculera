const Product = require('../models/Product');

const productController = {
  async getAll(req, res) {
    try {
      const products = await Product.findAll({ activeOnly: req.userRole !== 'admin' });
      res.json(products);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getOne(req, res) {
    try {
      const { idOrSlug } = req.params;
      const product = idOrSlug.includes('-') && !idOrSlug.match(/^[0-9a-f-]{36}$/)
        ? await Product.findBySlug(idOrSlug)
        : await Product.findById(idOrSlug);
      if (!product) return res.status(404).json({ error: 'Product not found' });
      res.json(product);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req, res) {
    try {
      const product = await Product.create(req.body);
      res.status(201).json(product);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  async update(req, res) {
    try {
      const product = await Product.update(req.params.id, req.body);
      if (!product) return res.status(404).json({ error: 'Product not found' });
      res.json(product);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
};

module.exports = productController;
