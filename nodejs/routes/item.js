const express = require('express');
const router = express.Router();
const db = require('../db');  // use the db.js file you made
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'devsecret';

// Middleware to get user_id from JWT
function authRequired(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'No token' });
  try {
    const decoded = jwt.verify(auth.slice(7), SECRET);
    req.user_id = decoded.id;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

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

// GET /products/featured - fetch up to 3 active products
router.get('/products/featured', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT item_id, name, description, sell_price, image FROM item WHERE status = "active" LIMIT 3'
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

// GET /products/details/:id - get product with category and seller info
router.get('/products/details/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT i.*, c.name AS category_name, s.business_name, s.business_description, s.business_email
      FROM item i
      LEFT JOIN categories c ON i.category_id = c.category_id
      LEFT JOIN sellers s ON i.seller_id = s.user_id
      WHERE i.item_id = ?
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Product not found' });
    // Parse image JSON
    try { rows[0].image = JSON.parse(rows[0].image); } catch {}
    res.json({ success: true, product: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch product details' });
  }
});

// GET /products/wishlist - fetch products by a list of IDs (for wishlist)
router.get('/products/wishlist', async (req, res) => {
  try {
    let ids = req.query.ids;
    if (!ids) return res.json({ success: true, products: [] });
    if (typeof ids === 'string') ids = ids.split(',').map(x => parseInt(x)).filter(x => !isNaN(x));
    if (!Array.isArray(ids) || !ids.length) return res.json({ success: true, products: [] });
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(`SELECT * FROM item WHERE item_id IN (${placeholders})`, ids);
    // Parse image JSON for each product
    rows.forEach(row => { try { row.image = JSON.parse(row.image); } catch {} });
    res.json({ success: true, products: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch wishlist products' });
  }
});

// GET /wishlist - get all wishlist item_ids for the logged-in user
router.get('/wishlist', authRequired, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT item_id FROM wishlist WHERE customer_id = (SELECT customer_id FROM customer WHERE user_id = ?)', [req.user_id]);
    const ids = rows.map(r => r.item_id);
    res.json({ success: true, wishlist: ids });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch wishlist' });
  }
});

// POST /wishlist - add an item to the wishlist for the logged-in user
router.post('/wishlist', authRequired, async (req, res) => {
  try {
    const item_id = req.body.item_id;
    console.log('[WISHLIST] user_id:', req.user_id, 'item_id:', item_id);
    if (!item_id) {
      console.log('[WISHLIST] Missing item_id');
      return res.status(400).json({ success: false, error: 'Missing item_id' });
    }
    // Get customer_id from user_id
    const [custRows] = await db.query('SELECT customer_id FROM customer WHERE user_id = ?', [req.user_id]);
    if (!custRows.length) {
      console.log('[WISHLIST] Not a customer for user_id:', req.user_id);
      return res.status(400).json({ success: false, error: 'Not a customer' });
    }
    const customer_id = custRows[0].customer_id;
    console.log('[WISHLIST] Found customer_id:', customer_id);
    // Insert if not exists
    await db.query('INSERT IGNORE INTO wishlist (customer_id, item_id) VALUES (?, ?)', [customer_id, item_id]);
    console.log('[WISHLIST] Added to wishlist:', { customer_id, item_id });
    res.json({ success: true });
  } catch (err) {
    console.error('[WISHLIST] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to add to wishlist' });
  }
});

// DELETE /wishlist/:item_id - remove an item from the wishlist for the logged-in user
router.delete('/wishlist/:item_id', authRequired, async (req, res) => {
  try {
    const item_id = req.params.item_id;
    // Get customer_id from user_id
    const [custRows] = await db.query('SELECT customer_id FROM customer WHERE user_id = ?', [req.user_id]);
    if (!custRows.length) return res.status(400).json({ success: false, error: 'Not a customer' });
    const customer_id = custRows[0].customer_id;
    await db.query('DELETE FROM wishlist WHERE customer_id = ? AND item_id = ?', [customer_id, item_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to remove from wishlist' });
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
