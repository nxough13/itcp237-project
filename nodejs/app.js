// app.js
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

const testDB = require('./routes/test-db');
const itemRoutes = require('./routes/item');
const authRoutes = require('./routes/auth');

// ✅ Middleware
app.use(cors({
  origin: '*', // or specify your frontend origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use('/api/v1', testDB); 
app.use('/api/v1', itemRoutes);
app.use('/api/v1', authRoutes);

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ✅ Sample Route (Temporary Test)
app.get('/api/v1/hello', (req, res) => {
  res.json({ message: 'Hello from your Node.js backend!' });
});

// ✅ Export the app
module.exports = app;
