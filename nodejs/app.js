// app.js
const express = require('express');
const cors = require('cors');

const app = express();

const testDB = require('./routes/test-db');



// ✅ Middleware
app.use(cors());
app.use(express.json());
app.use('/api/v1', testDB); 

// ✅ Sample Route (Temporary Test)
app.get('/api/v1/hello', (req, res) => {
  res.json({ message: 'Hello from your Node.js backend!' });
});


// ✅ Export the app
module.exports = app;
