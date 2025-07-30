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
    const [products] = await db.query(`
      SELECT 
        i.*,
        s.quantity as stock_quantity,
        c.name as category_name
      FROM item i
      LEFT JOIN stock s ON i.item_id = s.item_id
      LEFT JOIN categories c ON i.category_id = c.category_id
      WHERE i.seller_id = ?
    `, [req.user.id]);
    
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
    console.log('Seller', req.user.id, 'itemIds:', itemIds);
    let sql = `
      SELECT 
        o.orderinfo_id,
        o.order_number,
        o.date_placed,
        o.status AS order_status,
        o.total_amount,
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
    `;
    console.log('SQL:', sql);
    const [rows] = await db.query(sql, itemIds);
    // Group by orderinfo_id
    const ordersMap = {};
    for (const row of rows) {
      if (!ordersMap[row.orderinfo_id]) {
        ordersMap[row.orderinfo_id] = {
          orderinfo_id: row.orderinfo_id,
          order_number: row.order_number,
          date_placed: row.date_placed,
          order_status: row.order_status,
          customer_fname: row.customer_fname,
          customer_lname: row.customer_lname,
          total_amount: row.total_amount,
          products: [],
          quantity: 0
        };
      }
      ordersMap[row.orderinfo_id].products.push({ name: row.product_name, quantity: row.quantity });
      ordersMap[row.orderinfo_id].quantity += row.quantity;
    }
    const orders = Object.values(ordersMap);
    console.log('Orders result:', orders);
    res.json({ success: true, orders });
  } catch (err) {
    console.error('Error in /seller/orders:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch orders.', error: err.message });
  }
});

// PATCH /seller/orders/:orderinfo_id/status - update order status (cancelled/delivered)
router.patch('/seller/orders/:orderinfo_id/status', authenticateJWT, requireSellerRole, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['cancelled', 'delivered'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  }
  const orderinfo_id = req.params.orderinfo_id;
  const conn = await db.getConnection();
  try {
    // Get all item_ids for this seller
    const [sellerItems] = await conn.query('SELECT item_id FROM item WHERE seller_id = ?', [req.user.id]);
    const itemIds = sellerItems.map(i => i.item_id);
    if (!itemIds.length) return res.status(403).json({ success: false, message: 'No products for this seller.' });
    // Check if this order contains at least one of the seller's items
    const [orderLines] = await conn.query('SELECT item_id FROM orderline WHERE orderinfo_id = ?', [orderinfo_id]);
    const found = orderLines.some(ol => itemIds.includes(ol.item_id));
    if (!found) return res.status(403).json({ success: false, message: 'Order does not belong to your products.' });
    // Update order status
    await conn.query('UPDATE orderinfo SET status=? WHERE orderinfo_id=?', [status, orderinfo_id]);
    // Get customer email
    const [orderInfo] = await conn.query('SELECT o.order_number, u.email FROM orderinfo o JOIN customer c ON o.customer_id = c.customer_id JOIN users u ON c.user_id = u.id WHERE o.orderinfo_id = ?', [orderinfo_id]);
    if (orderInfo.length) {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
          user: process.env.EMAIL_USER || 'homehaven984@gmail.com',
          pass: process.env.EMAIL_PASS || 'nfiopcrbahrmxvru'
        }
      });
      let subject = '', text = '';
      if (status === 'cancelled') {
        subject = 'Order Cancelled';
        text = `Your order ${orderInfo[0].order_number} has been cancelled by the seller.`;
      } else if (status === 'delivered') {
        subject = 'Order Delivered';
        text = `Your order ${orderInfo[0].order_number} has been marked as delivered by the seller.`;
      }
      await transporter.sendMail({
        from: 'Home Haven <your_email@gmail.com>',
        to: orderInfo[0].email,
        subject,
        text
      });
    }
    res.json({ success: true, message: 'Order status updated and customer notified.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update order status.', error: err.message });
  } finally {
    conn.release();
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
        u.role AS user_role,
        u.profile_image
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

// PUT seller profile update (including image upload)
router.put('/seller/profile', authenticateJWT, requireSellerRole, upload.single('profile_image'), async (req, res) => {
  try {
    const { name, email, password, business_name, business_address, business_phone } = req.body;
    const conn = await db.getConnection();
    
    try {
      await conn.beginTransaction();
      
      // Update user table if name, email, or password provided
      if (name || email || password) {
        let userUpdateQuery = 'UPDATE users SET ';
        let userUpdateParams = [];
        
        if (name) {
          userUpdateQuery += 'name = ?, ';
          userUpdateParams.push(name);
        }
        if (email) {
          userUpdateQuery += 'email = ?, ';
          userUpdateParams.push(email);
        }
        if (password) {
          userUpdateQuery += 'password = ?, ';
          userUpdateParams.push(password); // Note: In production, hash the password
        }
        
        userUpdateQuery = userUpdateQuery.slice(0, -2); // Remove trailing comma and space
        userUpdateQuery += ' WHERE id = ?';
        userUpdateParams.push(req.user.id);
        
        await conn.query(userUpdateQuery, userUpdateParams);
      }
      
      // Update seller table if business info provided
      if (business_name || business_address || business_phone) {
        let sellerUpdateQuery = 'UPDATE sellers SET ';
        let sellerUpdateParams = [];
        
        if (business_name) {
          sellerUpdateQuery += 'business_name = ?, ';
          sellerUpdateParams.push(business_name);
        }
        if (business_address) {
          sellerUpdateQuery += 'business_address = ?, ';
          sellerUpdateParams.push(business_address);
        }
        if (business_phone) {
          sellerUpdateQuery += 'business_phone = ?, ';
          sellerUpdateParams.push(business_phone);
        }
        
        sellerUpdateQuery = sellerUpdateQuery.slice(0, -2); // Remove trailing comma and space
        sellerUpdateQuery += ' WHERE user_id = ?';
        sellerUpdateParams.push(req.user.id);
        
        await conn.query(sellerUpdateQuery, sellerUpdateParams);
      }
      
      // Handle profile image upload
      if (req.file) {
        const imagePath = '/uploads/' + req.file.filename;
        await conn.query('UPDATE users SET profile_image = ? WHERE id = ?', [imagePath, req.user.id]);
      }
      
      await conn.commit();
      res.json({ success: true, message: 'Profile updated successfully.' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Error updating seller profile:', err);
    res.status(500).json({ success: false, message: 'Failed to update profile.', error: err.message });
  }
});

module.exports = router; 