const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';

// Email transporter setup (use your real credentials in production)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // your gmail
    pass: process.env.EMAIL_PASS  // your gmail app password
  }
});

// Multer setup for profile image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, 'profile_' + req.user.id + '_' + Date.now() + ext);
  }
});
const upload = multer({ storage });

// JWT middleware
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

// POST /api/v1/login (update to return JWT)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.json({ success: false, message: 'Email and password are required' });
  }
  try {
    const [results] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (results.length === 0) {
      return res.json({ success: false, message: 'You are not a registered user, Please Register' });
    }
    const user = results[0];
    if (user.status !== 'active' || !user.email_verified_at) {
      return res.json({ success: false, message: 'Please verify your email before logging in.' });
    }
    // Plain text password check (for demo; use hashing in production)
    if (user.password === password) {
      // Create JWT
      const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
      return res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } else {
      return res.json({ success: false, message: 'Incorrect password' });
    }
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

// POST /api/v1/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.json({ success: false, message: 'All fields are required' });
  }
  // Password validation: at least one number and one special character
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  if (!hasNumber || !hasSpecial) {
    return res.json({ success: false, message: 'Your password should have at least one number and at least one special character.' });
  }
  try {
    const [results] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (results.length > 0) {
      return res.json({ success: false, message: 'Email already registered' });
    }
    // Save user as inactive and not verified
    await db.query(
      'INSERT INTO users (name, email, password, role, status, email_verified_at) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, password, 'user', 'inactive', null]
    );
    // Generate verification token
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1d' });
    const verifyUrl = `${BASE_URL}/api/v1/verify-email?token=${token}`;
    // Send verification email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify your Home Haven account',
      html: `<h2>Welcome to Home Haven!</h2><p>Click the link below to verify your email:</p><a href="${verifyUrl}">${verifyUrl}</a>`
    });
    return res.json({ success: true, message: 'Registration successful! Please check your email to verify your account.' });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

// GET /api/v1/verify-email
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Invalid verification link.');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const email = decoded.email;
    // Activate user
    await db.query('UPDATE users SET status = ?, email_verified_at = NOW() WHERE email = ?', ['active', email]);
    // Redirect to the correct login page
    return res.redirect('http://localhost:3000/our/jquery/login.html');
  } catch (err) {
    return res.status(400).send('Verification link is invalid or has expired.');
  }
});

// POST /api/v1/resend-verification
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ success: false, message: 'Email is required.' });
  try {
    const [results] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (results.length === 0) {
      return res.json({ success: false, message: 'No account found with that email.' });
    }
    const user = results[0];
    if (user.status === 'active' && user.email_verified_at) {
      return res.json({ success: false, message: 'Account is already verified.' });
    }
    // Generate verification token
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1d' });
    const verifyUrl = `${BASE_URL}/api/v1/verify-email?token=${token}`;
    // Send verification email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify your Home Haven account',
      html: `<h2>Welcome to Home Haven!</h2><p>Click the link below to verify your email:</p><a href="${verifyUrl}">${verifyUrl}</a>`
    });
    return res.json({ success: true, message: 'Verification email sent! Please check your inbox.' });
  } catch (err) {
    console.error('Resend verification error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send verification email.' });
  }
});

// GET /api/v1/profile (protected)
router.get('/profile', authenticateJWT, async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT users.id, users.name, users.email, users.role,
        COALESCE(customer.title, '') AS title,
        COALESCE(customer.fname, '') AS fname,
        COALESCE(customer.lname, '') AS lname,
        COALESCE(customer.addressline, '') AS address,
        COALESCE(customer.town, '') AS town,
        COALESCE(customer.zipcode, '') AS zipcode,
        COALESCE(customer.phone, '') AS phone,
        COALESCE(customer.image_path, '') AS image_path,
        COALESCE(customer.date_of_birth, '0000-00-00') AS date_of_birth
      FROM users
      LEFT JOIN customer ON users.id = customer.user_id
      WHERE users.id = ?
    `, [req.user.id]);
    if (results.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, profile: results[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch profile.' });
  }
});

// POST /api/v1/profile (protected, update info, with image upload)
router.post('/profile', authenticateJWT, upload.single('profile_image'), async (req, res) => {
  const { 
    name, address, phone, date_of_birth, password,
    title, fname, lname, town, zipcode 
  } = req.body;
  
  let imagePath = null;
  if (req.file) {
    imagePath = '/uploads/' + req.file.filename;
  }
  
  try {
    // Update users table (only if name is provided)
    if (name) {
      await db.query('UPDATE users SET name = ? WHERE id = ?', [name, req.user.id]);
    }
    
    // Update password if provided
    if (password && password.length > 0) {
      await db.query('UPDATE users SET password = ? WHERE id = ?', [password, req.user.id]);
    }
    
    // Check if customer record exists
    const [customerRows] = await db.query('SELECT * FROM customer WHERE user_id = ?', [req.user.id]);
    
    if (customerRows.length > 0) {
      // Update existing customer record with partial updates
      const updateFields = [];
      const updateValues = [];
      
      if (address !== undefined) {
        updateFields.push('addressline = ?');
        updateValues.push(address);
      }
      if (phone !== undefined) {
        updateFields.push('phone = ?');
        updateValues.push(phone);
      }
      if (date_of_birth !== undefined) {
        updateFields.push('date_of_birth = ?');
        updateValues.push(date_of_birth);
      }
      if (title !== undefined) {
        updateFields.push('title = ?');
        updateValues.push(title);
      }
      if (fname !== undefined) {
        updateFields.push('fname = ?');
        updateValues.push(fname);
      }
      if (lname !== undefined) {
        updateFields.push('lname = ?');
        updateValues.push(lname);
      }
      if (town !== undefined) {
        updateFields.push('town = ?');
        updateValues.push(town);
      }
      if (zipcode !== undefined) {
        updateFields.push('zipcode = ?');
        updateValues.push(zipcode);
      }
      if (imagePath) {
        updateFields.push('image_path = ?');
        updateValues.push(imagePath);
      }
      
      if (updateFields.length > 0) {
        updateValues.push(req.user.id);
        await db.query(`UPDATE customer SET ${updateFields.join(', ')} WHERE user_id = ?`, updateValues);
      }
    } else {
      // Create new customer record
      await db.query(
        'INSERT INTO customer (user_id, title, fname, lname, addressline, town, zipcode, phone, date_of_birth, image_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          req.user.id, 
          title || '', 
          fname || '', 
          lname || name || '', 
          address || '', 
          town || '', 
          zipcode || '', 
          phone || '', 
          date_of_birth || '0000-00-00', 
          imagePath || ''
        ]
      );
    }
    
    return res.json({ 
      success: true, 
      message: 'Profile updated successfully.', 
      image_path: imagePath 
    });
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

// POST /api/v1/upgrade-to-customer (protected)
router.post('/upgrade-to-customer', authenticateJWT, async (req, res) => {
  try {
    // Update user role
    await db.query('UPDATE users SET role = ? WHERE id = ?', ['customer', req.user.id]);
    // Create customer row if not exists
    const [customerRows] = await db.query('SELECT * FROM customer WHERE user_id = ?', [req.user.id]);
    if (customerRows.length === 0) {
      // Get user's name and split into fname/lname
      const [userRows] = await db.query('SELECT name FROM users WHERE id = ?', [req.user.id]);
      let fname = '', lname = '';
      if (userRows.length > 0) {
        const name = userRows[0].name.trim();
        const parts = name.split(' ');
        if (parts.length > 1) {
          fname = parts.slice(0, -1).join(' ');
          lname = parts.slice(-1).join(' ');
        } else {
          fname = lname = name;
        }
      }
      await db.query(
        'INSERT INTO customer (user_id, title, fname, lname, addressline, town, zipcode, phone, image_path, date_of_birth) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [req.user.id, '', fname, lname, '', '', '', '', '', '0000-00-00']
      );
    }
    return res.json({ success: true, message: 'Upgraded to customer.', role: 'customer' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to upgrade role.' });
  }
});

module.exports = router; 