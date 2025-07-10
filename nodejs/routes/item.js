const express = require('express');
const router = express.Router();
const db = require('../db');  // use the db.js file you made

router.get('/test-db', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT NOW() AS current_time');
    res.json({
      success: true,
      time: rows[0].current_time
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database connection failed' });
  }
});

// GET /products/featured - fetch up to 3 featured, active products
router.get('/products/featured', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT item_id, name, short_description, description, sell_price, image FROM item WHERE is_featured = 1 AND status = "active" LIMIT 3'
    );
    res.json({ success: true, products: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch featured products' });
  }
});

// GET /products - list all products
router.get('/products', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM item');
    res.json({ success: true, products: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

// GET /products/:id - get one product
router.get('/products/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM item WHERE item_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, product: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch product' });
  }
});

// POST /products - create product
router.post('/products', async (req, res) => {
  try {
    const { category_id, name, description, short_description, sku, cost_price, sell_price, image, weight, dimensions, material, color, style, room_type, status, is_featured, meta_title, meta_description } = req.body;
    const [result] = await db.query(
      'INSERT INTO item (category_id, name, description, short_description, sku, cost_price, sell_price, image, weight, dimensions, material, color, style, room_type, status, is_featured, meta_title, meta_description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [category_id, name, description, short_description, sku, cost_price, sell_price, image, weight, dimensions, material, color, style, room_type, status, is_featured, meta_title, meta_description]
    );
    res.status(201).json({ success: true, product_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to create product' });
  }
});

// PUT /products/:id - update product
router.put('/products/:id', async (req, res) => {
  try {
    const { category_id, name, description, short_description, sku, cost_price, sell_price, image, weight, dimensions, material, color, style, room_type, status, is_featured, meta_title, meta_description } = req.body;
    const [result] = await db.query(
      'UPDATE item SET category_id=?, name=?, description=?, short_description=?, sku=?, cost_price=?, sell_price=?, image=?, weight=?, dimensions=?, material=?, color=?, style=?, room_type=?, status=?, is_featured=?, meta_title=?, meta_description=?, updated_at=NOW() WHERE item_id=?',
      [category_id, name, description, short_description, sku, cost_price, sell_price, image, weight, dimensions, material, color, style, room_type, status, is_featured, meta_title, meta_description, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to update product' });
  }
});

// DELETE /products/:id - delete product
router.delete('/products/:id', async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM item WHERE item_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to delete product' });
  }
});

module.exports = router;
