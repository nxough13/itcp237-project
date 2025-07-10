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

module.exports = router;
