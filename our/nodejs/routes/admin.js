const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

// JWT middleware (copied from auth.js)
function authenticateJWT(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ success: false, message: 'No token provided.' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token provided.' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid token.' });
    req.user = user;
    next();
  });
}

// Admin-only middleware
function adminOnly(req, res, next) {
  authenticateJWT(req, res, function() {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }
    next();
  });
}

// List all users
router.get('/users', adminOnly, async (req, res) => {
  try {
    const [users] = await db.query('SELECT id, name, email, role, status, profile_image, created_at FROM users');
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch users', error: err.message });
  }
});

// Update user role
router.patch('/users/:id/role', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!['user', 'customer', 'seller', 'admin'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role' });
  }
  try {
    await db.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    res.json({ success: true, message: 'Role updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update role', error: err.message });
  }
});

// Update user status (activate/deactivate)
router.patch('/users/:id/status', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }
  try {
    await db.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update status', error: err.message });
  }
});

// List all customers (join users + customer)
router.get('/customers', adminOnly, async (req, res) => {
  try {
    const [customers] = await db.query(`
      SELECT u.id, u.name, u.email, u.role, u.status, u.profile_image, u.created_at,
             c.customer_id, c.fname, c.lname, c.addressline, c.town, c.zipcode, c.phone, c.image_path
      FROM users u
      JOIN customer c ON u.id = c.user_id
    `);
    res.json({ success: true, customers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch customers', error: err.message });
  }
});

// List all verified sellers (join users + sellers)
router.get('/sellers', adminOnly, async (req, res) => {
  try {
    const [sellers] = await db.query(`
      SELECT u.id, u.name, u.email, u.role, u.status, u.profile_image, u.created_at,
             s.seller_id, s.business_name, s.business_description, s.business_address, s.business_phone, s.business_email, s.is_verified
      FROM users u
      JOIN sellers s ON u.id = s.user_id
      WHERE s.is_verified = 1
    `);
    res.json({ success: true, sellers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch sellers', error: err.message });
  }
});

// List all unverified sellers (admin only)
router.get('/sellers/unverified', adminOnly, async (req, res) => {
  try {
    const [sellers] = await db.query(`
      SELECT u.id, u.name, u.email, u.role, u.status, u.profile_image, u.created_at,
             s.seller_id, s.business_name, s.business_description, s.business_address, s.business_phone, s.business_email, s.is_verified
      FROM users u
      JOIN sellers s ON u.id = s.user_id
      WHERE s.is_verified = 0
    `);
    res.json({ success: true, sellers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch unverified sellers', error: err.message });
  }
});

// Verify a seller (admin only)
router.patch('/sellers/:sellerId/verify', adminOnly, async (req, res) => {
  const { sellerId } = req.params;
  try {
    const [result] = await db.query('UPDATE sellers SET is_verified = 1 WHERE seller_id = ?', [sellerId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }
    res.json({ success: true, message: 'Seller verified' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to verify seller', error: err.message });
  }
});

// Get all items for a specific seller
router.get('/sellers/:sellerId/items', adminOnly, async (req, res) => {
  const { sellerId } = req.params;
  try {
    const [items] = await db.query(`
      SELECT item_id, name, description, sku, sell_price, image, status, created_at
      FROM item
      WHERE seller_id = ?
    `, [sellerId]);
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch items', error: err.message });
  }
});

// Update status of a product (active/inactive)
router.patch('/items/:itemId/status', adminOnly, async (req, res) => {
  const { itemId } = req.params;
  const { status } = req.body;
  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }
  try {
    await db.query('UPDATE item SET status = ? WHERE item_id = ?', [status, itemId]);
    res.json({ success: true, message: 'Item status updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update item status', error: err.message });
  }
});

// GET all orders with customer and item info (admin only)
router.get('/orders', adminOnly, async (req, res) => {
  try {
    // Get all orders with customer info
    const [orders] = await db.query(`
      SELECT o.orderinfo_id, o.order_number, o.date_placed, o.status, o.total_amount,
             c.fname AS customer_fname, c.lname AS customer_lname, u.email AS customer_email
      FROM orderinfo o
      JOIN customer c ON o.customer_id = c.customer_id
      JOIN users u ON c.user_id = u.id
      ORDER BY o.date_placed DESC
    `);
    if (!orders.length) return res.json({ success: true, orders: [] });
    // Get all orderlines for these orders
    const orderIds = orders.map(o => o.orderinfo_id);
    const [orderlines] = await db.query(`
      SELECT ol.orderinfo_id, ol.item_name, ol.quantity
      FROM orderline ol
      WHERE ol.orderinfo_id IN (${orderIds.map(() => '?').join(',')})
    `, orderIds);
    // Group items by order
    const orderItemsMap = {};
    for (const ol of orderlines) {
      if (!orderItemsMap[ol.orderinfo_id]) orderItemsMap[ol.orderinfo_id] = [];
      orderItemsMap[ol.orderinfo_id].push({ name: ol.item_name, quantity: ol.quantity });
    }
    // Attach items and customer name to each order
    const result = orders.map(o => ({
      orderinfo_id: o.orderinfo_id,
      order_number: o.order_number,
      date_placed: o.date_placed,
      status: o.status,
      total_amount: o.total_amount,
      customer_name: `${o.customer_fname} ${o.customer_lname}`.trim(),
      customer_email: o.customer_email,
      items: orderItemsMap[o.orderinfo_id] || []
    }));
    res.json({ success: true, orders: result });
  } catch (err) {
    console.error('Admin orders error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch orders', error: err.message });
  }
});

// GET all items with category, stock, and seller info (admin only)
router.get('/items', adminOnly, async (req, res) => {
  try {
    const [items] = await db.query(`
      SELECT i.item_id, i.name, i.sku, i.sell_price, i.status, i.created_at,
             c.name AS category_name, c.category_id,
             st.quantity AS stock_quantity,
             u.id AS seller_id, u.name AS seller_name
      FROM item i
      LEFT JOIN categories c ON i.category_id = c.category_id
      LEFT JOIN stock st ON i.item_id = st.item_id
      LEFT JOIN users u ON i.seller_id = u.id
      ORDER BY i.created_at DESC
    `);
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch items', error: err.message });
  }
});

// GET all categories (admin only)
router.get('/categories', adminOnly, async (req, res) => {
  try {
    const [categories] = await db.query('SELECT category_id, name FROM categories WHERE is_active = 1 ORDER BY name');
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories', error: err.message });
  }
});

// GET all sellers (admin only)
router.get('/sellers/all', adminOnly, async (req, res) => {
  try {
    const [sellers] = await db.query('SELECT u.id AS seller_id, u.name AS seller_name FROM users u WHERE u.role = "seller" ORDER BY u.name');
    res.json({ success: true, sellers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch sellers', error: err.message });
  }
});

module.exports = router; 