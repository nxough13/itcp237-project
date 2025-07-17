const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateJWT } = require('./auth');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Multer setup for multiple image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, 'product_' + Date.now() + '_' + Math.round(Math.random() * 1E9) + ext);
  }
});
const upload = multer({ storage });

// Middleware to check if user is a seller
function requireSellerRole(req, res, next) {
  if (req.user && req.user.role === 'seller') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Access denied. Seller only.' });
}

// ----------- PRODUCTS CRUD -----------
// GET all products for this seller
router.get('/seller/products', authenticateJWT, requireSellerRole, async (req, res) => {
  try {
    const [products] = await db.query('SELECT * FROM item WHERE seller_id = ?', [req.user.id]);
    // Parse image JSON for each product
    products.forEach(p => {
      try { p.image = JSON.parse(p.image); } catch { p.image = []; }
    });
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch products.' });
  }
});

// ADD a new product (with multiple images and stock)
router.post('/seller/products', authenticateJWT, requireSellerRole, upload.array('images', 10), async (req, res) => {
  const { category_id, name, description, sku, sell_price, status, stock } = req.body;
  if (!category_id || !name || !sku || !sell_price || stock === undefined) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }
  let imagePaths = [];
  if (req.files && req.files.length > 0) {
    imagePaths = req.files.map(f => '/uploads/' + f.filename);
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [itemResult] = await conn.query(
      'INSERT INTO item (category_id, name, description, sku, sell_price, image, status, seller_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [category_id, name, description || '', sku, sell_price, JSON.stringify(imagePaths), status || 'active', req.user.id]
    );
    const itemId = itemResult.insertId;
    await conn.query('INSERT INTO stock (item_id, quantity) VALUES (?, ?)', [itemId, stock]);
    await conn.commit();
    res.json({ success: true, message: 'Product added.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: 'Failed to add product.' });
  } finally {
    conn.release();
  }
});

// UPDATE a product (add/remove images and update stock)
router.put('/seller/products/:id', authenticateJWT, requireSellerRole, upload.array('images', 10), async (req, res) => {
  const { category_id, name, description, sku, sell_price, status, remove_images, stock } = req.body;
  if (stock === undefined) {
    return res.status(400).json({ success: false, message: 'Stock is required.' });
  }
  const conn = await db.getConnection();
  try {
    // Get current product
    const [rows] = await conn.query('SELECT * FROM item WHERE item_id=? AND seller_id=?', [req.params.id, req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found or not owned by you.' });
    }
    let currentImages = [];
    try { currentImages = JSON.parse(rows[0].image); } catch { currentImages = []; }
    // Remove images if specified
    let removeList = [];
    if (remove_images) {
      try { removeList = JSON.parse(remove_images); } catch { removeList = []; }
      currentImages = currentImages.filter(img => !removeList.includes(img));
      // Optionally delete files from disk
      removeList.forEach(imgPath => {
        const absPath = path.join(__dirname, '../../', imgPath);
        if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
      });
    }
    // Add new images
    if (req.files && req.files.length > 0) {
      const newPaths = req.files.map(f => '/uploads/' + f.filename);
      currentImages = currentImages.concat(newPaths);
    }
    await conn.beginTransaction();
    await conn.query(
      'UPDATE item SET category_id=?, name=?, description=?, sku=?, sell_price=?, image=?, status=? WHERE item_id=? AND seller_id=?',
      [category_id, name, description, sku, sell_price, JSON.stringify(currentImages), status, req.params.id, req.user.id]
    );
    await conn.query('UPDATE stock SET quantity=? WHERE item_id=?', [stock, req.params.id]);
    await conn.commit();
    res.json({ success: true, message: 'Product updated.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: 'Failed to update product.' });
  } finally {
    conn.release();
  }
});

// DELETE a specific image from a product
router.delete('/seller/products/:id/image', authenticateJWT, requireSellerRole, async (req, res) => {
  const { image_path } = req.body;
  if (!image_path) return res.status(400).json({ success: false, message: 'Image path required.' });
  try {
    const [rows] = await db.query('SELECT * FROM item WHERE item_id=? AND seller_id=?', [req.params.id, req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found or not owned by you.' });
    }
    let images = [];
    try { images = JSON.parse(rows[0].image); } catch { images = []; }
    images = images.filter(img => img !== image_path);
    // Delete file from disk
    const absPath = path.join(__dirname, '../../', image_path);
    if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
    await db.query('UPDATE item SET image=? WHERE item_id=? AND seller_id=?', [JSON.stringify(images), req.params.id, req.user.id]);
    res.json({ success: true, message: 'Image removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to remove image.' });
  }
});

// ----------- CATEGORIES CRUD -----------
// GET all categories (global)
router.get('/seller/categories', authenticateJWT, requireSellerRole, async (req, res) => {
  try {
    const [categories] = await db.query('SELECT * FROM categories');
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories.' });
  }
});

// ADD a new category (global)
router.post('/seller/categories', authenticateJWT, requireSellerRole, async (req, res) => {
  const { name, description, is_active } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: 'Category name is required.' });
  }
  try {
    await db.query(
      'INSERT INTO categories (name, description, is_active) VALUES (?, ?, ?)',
      [name, description || '', is_active !== undefined ? is_active : 1]
    );
    res.json({ success: true, message: 'Category added.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add category.' });
  }
});

// UPDATE a category (global)
router.put('/seller/categories/:id', authenticateJWT, requireSellerRole, async (req, res) => {
  const { name, description, is_active } = req.body;
  try {
    const [result] = await db.query(
      'UPDATE categories SET name=?, description=?, is_active=? WHERE category_id=?',
      [name, description, is_active, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }
    res.json({ success: true, message: 'Category updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update category.' });
  }
});

// DELETE a category (global)
router.delete('/seller/categories/:id', authenticateJWT, requireSellerRole, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM categories WHERE category_id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }
    res.json({ success: true, message: 'Category deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete category.' });
  }
});

// ----------- ORDERS FOR SELLER PRODUCTS -----------
// GET all orders for this seller's products
router.get('/seller/orders', authenticateJWT, requireSellerRole, async (req, res) => {
  try {
    // Join item, orderline, orderinfo, customer to get all orders for seller's products
    const [orders] = await db.query(`
      SELECT 
        oi.orderinfo_id, oi.order_number, oi.date_placed, oi.status AS order_status, oi.payment_status, oi.total_amount,
        ol.orderline_id, ol.item_id, ol.item_name, ol.quantity, ol.unit_price, ol.total_price,
        c.customer_id, c.fname AS customer_fname, c.lname AS customer_lname,
        i.seller_id, i.name AS product_name, i.image AS product_image
      FROM orderline ol
      JOIN orderinfo oi ON ol.orderinfo_id = oi.orderinfo_id
      JOIN customer c ON oi.customer_id = c.customer_id
      JOIN item i ON ol.item_id = i.item_id
      WHERE i.seller_id = ?
      ORDER BY oi.date_placed DESC
    `, [req.user.id]);
    // Parse product image JSON if needed
    orders.forEach(o => {
      try { o.product_image = JSON.parse(o.product_image); } catch { o.product_image = []; }
    });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch seller orders.' });
  }
});

// GET seller profile for the logged-in seller
router.get('/seller/profile', authenticateJWT, requireSellerRole, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM sellers WHERE user_id = ?', [req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Seller profile not found.' });
    }
    res.json({ success: true, seller: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch seller profile.' });
  }
});

// PUBLIC: Get all products for a specific seller (for customer catalog view)
router.get('/catalog/seller/:seller_id', async (req, res) => {
  try {
    const sellerId = req.params.seller_id;
    // Get seller info
    const [sellerRows] = await db.query('SELECT * FROM sellers WHERE seller_id = ?', [sellerId]);
    if (sellerRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Seller not found.' });
    }
    // Get products for this seller, join category for name
    const [products] = await db.query(`
      SELECT i.*, c.name AS category_name
      FROM item i
      LEFT JOIN categories c ON i.category_id = c.category_id
      WHERE i.seller_id = ? AND i.status = 'active'
    `, [sellerId]);
    // Parse image JSON for each product
    products.forEach(p => {
      try { p.image = JSON.parse(p.image); } catch { p.image = p.image; }
    });
    res.json({ success: true, products, seller: sellerRows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch seller catalog.' });
  }
});

module.exports = router; 