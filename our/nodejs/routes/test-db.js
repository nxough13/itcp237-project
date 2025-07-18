// routes/test-db.js
const express = require('express');
const router = express.Router();
const db = require('../db');  // your db connection file

router.get('/test-db', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS solution');
    res.json({ message: 'Database connected!', result: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

module.exports = router;
