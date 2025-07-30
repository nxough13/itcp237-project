const express = require('express');
const router = express.Router();
const db = require('../db');  // use the db.js file you made
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'devsecret';
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const PDFDocument = require('pdfkit');
const fs = require('fs');
// Multer setup for GCash receipt upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, 'gcash_' + Date.now() + '_' + Math.round(Math.random() * 1E9) + ext);
  }
});
const upload = multer({ storage });

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

// GET /products - list all products (with stock and category)
router.get('/products', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT i.*, c.name AS category_name, st.quantity AS stock_quantity
      FROM item i
      LEFT JOIN categories c ON i.category_id = c.category_id
      LEFT JOIN stock st ON i.item_id = st.item_id
    `);
    // Parse image JSON for each product if needed
    rows.forEach(row => { try { row.image = JSON.parse(row.image); } catch {} });
    res.json({ success: true, products: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

// GET /products/categories - public endpoint to fetch all categories
router.get('/products/categories', async (req, res) => {
  try {
    const [categories] = await db.query('SELECT * FROM categories WHERE is_active = 1');
    res.json({ success: true, categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
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

// GET /products/details/:id - get product with category, seller, and stock info
router.get('/products/details/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT i.*, c.name AS category_name, s.business_name, s.business_description, s.business_email, st.quantity AS stock_quantity
      FROM item i
      LEFT JOIN categories c ON i.category_id = c.category_id
      LEFT JOIN sellers s ON i.seller_id = s.user_id
      LEFT JOIN stock st ON i.item_id = st.item_id
      WHERE i.item_id = ?
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Product not found' });
    try { rows[0].image = JSON.parse(rows[0].image); } catch {}
    res.json({ success: true, product: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch product details' });
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

// --- CART ENDPOINTS ---
// GET /cart - fetch current user's cart
router.get('/cart', authRequired, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM shopping_cart WHERE user_id = ?', [req.user_id]);
    res.json({ success: true, cart: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch cart' });
  }
});
// POST /cart/add - add or update item in cart
router.post('/cart/add', authRequired, async (req, res) => {
  try {
    const { item_id, quantity, price } = req.body;
    if (!item_id || !quantity || !price) return res.status(400).json({ success: false, error: 'Missing fields' });
    // Upsert logic: if exists, update quantity; else insert
    const [existing] = await db.query('SELECT * FROM shopping_cart WHERE user_id = ? AND item_id = ?', [req.user_id, item_id]);
    if (existing.length) {
      await db.query('UPDATE shopping_cart SET quantity = quantity + ? WHERE user_id = ? AND item_id = ?', [quantity, req.user_id, item_id]);
    } else {
      await db.query('INSERT INTO shopping_cart (user_id, item_id, quantity, price) VALUES (?, ?, ?, ?)', [req.user_id, item_id, quantity, price]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to add to cart' });
  }
});
// POST /cart/remove - remove item from cart
router.post('/cart/remove', authRequired, async (req, res) => {
  try {
    const { item_id } = req.body;
    if (!item_id) return res.status(400).json({ success: false, error: 'Missing item_id' });
    await db.query('DELETE FROM shopping_cart WHERE user_id = ? AND item_id = ?', [req.user_id, item_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to remove from cart' });
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

// GET /products/:id/reviews - fetch all reviews for a product
router.get('/products/:id/reviews', async (req, res) => {
  const item_id = req.params.id;
  let user_id = null;
  let customer_id = null;
  // Try to get user_id from JWT if present
  try {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      const jwt = require('jsonwebtoken');
      const SECRET = process.env.JWT_SECRET || 'devsecret';
      const decoded = jwt.verify(auth.slice(7), SECRET);
      user_id = decoded.id;
    }
  } catch {}
  if (user_id) {
    const [custRows] = await db.query('SELECT customer_id FROM customer WHERE user_id = ?', [user_id]);
    if (custRows.length) customer_id = custRows[0].customer_id;
  }
  try {
    const [reviews] = await db.query('SELECT r.*, c.fname, c.lname FROM reviews r JOIN customer c ON r.customer_id = c.customer_id WHERE r.item_id = ?', [item_id]);
    const reviewsWithFlag = reviews.map(r => ({
      ...r,
      is_own_review: customer_id && r.customer_id === customer_id
    }));
    res.json({ success: true, reviews: reviewsWithFlag });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch reviews.' });
  }
});

// POST /products/:id/reviews - add a review (must have delivered order)
router.post('/products/:id/reviews', authRequired, async (req, res) => {
  const { rating, review_text } = req.body;
  const item_id = req.params.id;
  const user_id = req.user_id;
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: 'Rating must be 1-5.' });
  }
  try {
    // Get customer_id for this user
    const [custRows] = await db.query('SELECT customer_id FROM customer WHERE user_id = ?', [user_id]);
    if (!custRows.length) return res.status(403).json({ success: false, message: 'Not a customer.' });
    const customer_id = custRows[0].customer_id;
    // Check for delivered order
    const [orderRows] = await db.query(`
      SELECT 1 FROM orderline ol
      JOIN orderinfo o ON ol.orderinfo_id = o.orderinfo_id
      WHERE ol.item_id = ? AND o.customer_id = ? AND o.status = 'delivered'
      LIMIT 1
    `, [item_id, customer_id]);
    if (!orderRows.length) return res.status(403).json({ success: false, message: 'You can only review products you have received (delivered).' });
    // If this is an eligibility check, do not insert a review
    if (review_text === '__eligibility_check__') {
      return res.json({ success: true, eligible: true });
    }
    // Insert review (allow multiple reviews)
    await db.query('INSERT INTO reviews (item_id, customer_id, rating, review_text) VALUES (?, ?, ?, ?)', [item_id, customer_id, rating, review_text || null]);
    res.json({ success: true, message: 'Review submitted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to submit review.' });
  }
});

// PUT /products/:id/reviews/:review_id - edit a review (only by owner)
router.put('/products/:id/reviews/:review_id', authRequired, async (req, res) => {
  const { rating, review_text } = req.body;
  const item_id = req.params.id;
  const review_id = req.params.review_id;
  const user_id = req.user_id;
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: 'Rating must be 1-5.' });
  }
  try {
    // Get customer_id for this user
    const [custRows] = await db.query('SELECT customer_id FROM customer WHERE user_id = ?', [user_id]);
    if (!custRows.length) return res.status(403).json({ success: false, message: 'Not a customer.' });
    const customer_id = custRows[0].customer_id;
    // Check ownership
    const [revRows] = await db.query('SELECT * FROM reviews WHERE review_id = ? AND item_id = ? AND customer_id = ?', [review_id, item_id, customer_id]);
    if (!revRows.length) return res.status(403).json({ success: false, message: 'You can only edit your own review.' });
    await db.query('UPDATE reviews SET rating = ?, review_text = ? WHERE review_id = ?', [rating, review_text, review_id]);
    res.json({ success: true, message: 'Review updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update review.' });
  }
});

// DELETE /products/:id/reviews/:review_id - delete a review (only by owner)
router.delete('/products/:id/reviews/:review_id', authRequired, async (req, res) => {
  const item_id = req.params.id;
  const review_id = req.params.review_id;
  const user_id = req.user_id;
  try {
    // Get customer_id for this user
    const [custRows] = await db.query('SELECT customer_id FROM customer WHERE user_id = ?', [user_id]);
    if (!custRows.length) return res.status(403).json({ success: false, message: 'Not a customer.' });
    const customer_id = custRows[0].customer_id;
    // Check ownership
    const [revRows] = await db.query('SELECT * FROM reviews WHERE review_id = ? AND item_id = ? AND customer_id = ?', [review_id, item_id, customer_id]);
    if (!revRows.length) return res.status(403).json({ success: false, message: 'You can only delete your own review.' });
    await db.query('DELETE FROM reviews WHERE review_id = ?', [review_id]);
    res.json({ success: true, message: 'Review deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete review.' });
  }
});

// POST /orders/place - place an order for the logged-in user
router.post('/orders/place', authRequired, upload.single('gcash_receipt'), async (req, res) => {
  const user_id = req.user_id;
  let items, payment_method, gcash_phone, gcash_receipt;
  if (req.is('multipart/form-data')) {
    items = JSON.parse(req.body.items);
    payment_method = req.body.payment_method;
    gcash_phone = req.body.gcash_phone;
    gcash_receipt = req.file ? '/uploads/' + req.file.filename : null;
  } else {
    items = req.body.items;
    payment_method = req.body.payment_method;
    gcash_phone = req.body.gcash_phone;
    gcash_receipt = null;
  }
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ success: false, error: 'No items in order.' });
  if (!payment_method || !['cash','gcash'].includes(payment_method)) return res.status(400).json({ success: false, error: 'Invalid payment method.' });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // Get customer_id
    const [custRows] = await conn.query('SELECT customer_id, fname, lname, addressline, town, zipcode, phone FROM customer WHERE user_id = ?', [user_id]);
    if (!custRows.length) throw new Error('Customer not found');
    const customer_id = custRows[0].customer_id;
    // Set payment_status
    let payment_status = payment_method === 'cash' ? 'pending' : 'paid';
    // Insert orderinfo
    const now = new Date();
    const deliveryDate = new Date(now.getTime() + 24*60*60*1000); // +1 day
    const order_number = 'ORD-' + Date.now();
    const [orderRes] = await conn.query(
      'INSERT INTO orderinfo (customer_id, order_number, date_placed, status, payment_status, payment_method, gcash_phone, gcash_receipt, subtotal, shipping, total_amount, ship_fname, ship_lname, ship_address, ship_town, ship_zipcode, ship_phone, created_at) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [customer_id, order_number, 'confirmed', payment_status, payment_method, gcash_phone || null, gcash_receipt, 0, 0, 0, custRows[0].fname, custRows[0].lname, custRows[0].addressline, custRows[0].town, custRows[0].zipcode, custRows[0].phone]
    );
    const orderinfo_id = orderRes.insertId;
    let subtotal = 0;
    // Insert orderline for each item
    for (const item of items) {
      const [prodRows] = await conn.query('SELECT name, sell_price, seller_id FROM item WHERE item_id = ?', [item.item_id]);
      if (!prodRows.length) throw new Error('Product not found');
      const unit_price = prodRows[0].sell_price;
      const total_price = unit_price * item.quantity;
      subtotal += total_price;
      await conn.query('INSERT INTO orderline (orderinfo_id, item_id, item_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)',
        [orderinfo_id, item.item_id, prodRows[0].name, item.quantity, unit_price, total_price]);
      // Decrement stock for this item
      await conn.query('UPDATE stock SET quantity = quantity - ? WHERE item_id = ?', [item.quantity, item.item_id]);
    }
    // Update subtotal, total_amount
    await conn.query('UPDATE orderinfo SET subtotal=?, total_amount=? WHERE orderinfo_id=?', [subtotal, subtotal, orderinfo_id]);
    await conn.commit();
    // Generate PDF receipt
    function generateOrderPDF(order, items, customer) {
      return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          resolve(pdfData);
        });
        doc.fontSize(20).text('Order Receipt', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Order Number: ${order.order_number}`);
        doc.text(`Date: ${new Date(order.date_placed || Date.now()).toLocaleString()}`);
        doc.text(`Customer: ${customer.fname} ${customer.lname}`);
        doc.text(`Address: ${customer.addressline}, ${customer.town}, ${customer.zipcode}`);
        doc.text(`Phone: ${customer.phone}`);
        doc.moveDown();
        doc.fontSize(14).text('Items:', { underline: true });
        items.forEach(item => {
          doc.fontSize(12).text(`${item.item_name} (x${item.quantity}) - ₱${item.unit_price} each`);
        });
        doc.moveDown();
        doc.fontSize(14).text(`Total: ₱${order.total_amount}`);
        doc.end();
      });
    }
    // Fetch orderinfo and orderline for PDF
    const [[orderInfoRow]] = await conn.query('SELECT * FROM orderinfo WHERE orderinfo_id = ?', [orderinfo_id]);
    const [orderLineRows] = await conn.query('SELECT * FROM orderline WHERE orderinfo_id = ?', [orderinfo_id]);
    const pdfBuffer = await generateOrderPDF(orderInfoRow, orderLineRows, custRows[0]);
    // Send emails (customer and sellers)
    try {
      // Setup nodemailer using environment variables
      const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
          user: process.env.EMAIL_USER || 'homehaven984@gmail.com',
          pass: process.env.EMAIL_PASS || 'nfiopcrbahrmxvru'
        }
      });
      // Customer email
      const [userRows] = await conn.query('SELECT email FROM users WHERE id = ?', [user_id]);
      const customerEmail = userRows[0].email;
      await transporter.sendMail({
        from: 'Home Haven <your_email@gmail.com>',
        to: customerEmail,
        subject: 'Order Confirmation',
        text: `Thank you for your order! Order Number: ${order_number}`,
        attachments: [
          {
            filename: `OrderReceipt_${order_number}.pdf`,
            content: pdfBuffer
          }
        ]
      });
      // Seller emails
      const [sellerRows] = await conn.query('SELECT DISTINCT u.email FROM item i JOIN users u ON i.seller_id = u.id WHERE i.item_id IN (?)', [items.map(i=>i.item_id)]);
      for (const seller of sellerRows) {
        await transporter.sendMail({
          from: 'Home Haven <your_email@gmail.com>',
          to: seller.email,
          subject: 'New Order Received',
          text: `You have a new order. Order Number: ${order_number}`
        });
      }
    } catch (emailErr) {
      console.error('Email error:', emailErr);
    }
    res.json({ success: true, orderinfo_id });
  } catch (err) {
    await conn.rollback();
    console.error('Order placement error:', err);
    res.status(500).json({ success: false, error: 'Failed to place order.' });
  } finally {
    conn.release();
  }
});
// POST /cart/clear - clear the user's cart after order placement
router.post('/cart/clear', authRequired, async (req, res) => {
  try {
    await db.query('DELETE FROM shopping_cart WHERE user_id = ?', [req.user_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to clear cart' });
  }
});

module.exports = router;
