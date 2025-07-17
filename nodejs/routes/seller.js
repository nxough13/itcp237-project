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
    // Parse image JSON or comma-separated string for each product
    products.forEach(p => {
      try {
        p.image = JSON.parse(p.image);
        if (!Array.isArray(p.image)) throw new Error();
      } catch {
        // Fallback: split by comma if not JSON
        p.image = typeof p.image === 'string' && p.image.trim() !== ''
          ? p.image.split(',').map(s => s.trim()).filter(Boolean)
          : [];
      }
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

// DELETE a product
router.delete('/seller/products/:id', authenticateJWT, requireSellerRole, async (req, res) => {
  try {
    // Optionally: delete images from disk here if needed
    await db.query('DELETE FROM item WHERE item_id = ? AND seller_id = ?', [req.params.id, req.user.id]);
    await db.query('DELETE FROM stock WHERE item_id = ?', [req.params.id]);
    res.json({ success: true, message: 'Product deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete product.' });
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

// ----------- ORDERS FOR SELLER DASHBOARD -----------
// GET all orders for this seller's products
router.get('/seller/orders', authenticateJWT, requireSellerRole, async (req, res) => {
  try {
    // Get all products for this seller
    const [products] = await db.query('SELECT item_id, name, category_id FROM item WHERE seller_id = ?', [req.user.id]);
    if (!products.length) return res.json({ success: true, orders: [] });
    const itemIds = products.map(p => p.item_id);
    // Get all order lines for these products, join with orderinfo and customer
    const [orders] = await db.query(`
      SELECT 
        o.orderinfo_id,
        o.order_number,
        o.date_placed,
        o.status AS order_status,
        ol.item_id,
        ol.item_name AS product_name,
        ol.quantity,
        c.fname AS customer_fname,
        c.lname AS customer_lname
      FROM orderline ol
      JOIN orderinfo o ON ol.orderinfo_id = o.orderinfo_id
      JOIN customer c ON o.customer_id = c.customer_id
      WHERE ol.item_id IN (${itemIds.map(() => '?').join(',')})
      ORDER BY o.date_placed DESC
    `, itemIds);
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch orders.', error: err.message });
  }
});

// ----------- SELLER PROFILE -----------
// GET seller profile for the logged-in seller
router.get('/seller/profile', authenticateJWT, requireSellerRole, async (req, res) => {
  try {
    console.log('Fetching seller profile for user_id:', req.user.id);
    const [rows] = await db.query(`
      SELECT 
        s.seller_id,
        s.business_name,
        s.business_description,
        s.business_address,
        s.business_phone,
        s.business_email,
        s.is_verified,
        u.name AS user_name,
        u.email AS user_email,
        u.role AS user_role
      FROM sellers s
      JOIN users u ON s.user_id = u.id
      WHERE s.user_id = ?
      LIMIT 1
    `, [req.user.id]);
    console.log('Query result:', rows);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Seller profile not found.' });
    res.json({ success: true, profile: rows[0] });
  } catch (err) {
    console.error('Error fetching seller profile:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch seller profile.', error: err.message });
  }
});

module.exports = router; 