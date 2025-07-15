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

module.exports = router; 