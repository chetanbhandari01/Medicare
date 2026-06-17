/**
 * MediCare - Auth Routes
 * Simple PIN-based login for the Receptionist dashboard
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET is not set in .env');
  process.exit(1);
}
const TOKEN_EXPIRY = '12h';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, pin } = req.body;

  if (!username || !pin) {
    return res.status(400).json({ error: 'Username and PIN are required.' });
  }

  const validUsername = process.env.RECEPTIONIST_USERNAME;
  const validPin      = process.env.RECEPTIONIST_PIN;

  if (!validUsername || !validPin) {
    return res.status(500).json({ error: 'Server auth not configured. Set RECEPTIONIST_USERNAME and RECEPTIONIST_PIN in .env' });
  }

  if (username.trim() !== validUsername || String(pin).trim() !== validPin) {
    return res.status(401).json({ error: 'Invalid username or PIN. Please try again.' });
  }

  const token = jwt.sign(
    { role: 'receptionist', username },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  res.json({
    success: true,
    token,
    role: 'receptionist',
    username,
    expiresIn: TOKEN_EXPIRY,
  });
});

// POST /api/auth/verify - lightweight token check
router.post('/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ valid: false, error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, role: decoded.role, username: decoded.username });
  } catch {
    res.status(401).json({ valid: false, error: 'Token expired or invalid' });
  }
});

module.exports = router;
