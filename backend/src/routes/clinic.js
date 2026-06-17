/**
 * MediCare - Clinic Routes
 */
const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const Clinic = require('../models/Clinic');
const { checkHealth } = require('../services/mlService');

// GET /api/clinic - Get clinic info
router.get('/', async (req, res) => {
  try {
    let clinic = await Clinic.findOne();
    if (!clinic) {
      clinic = await Clinic.create({
        clinicId: process.env.CLINIC_ID || 'clinic_001',
        name: 'MediCare Clinic',
        doctorName: 'Dr. Hiralal Pawar',
        specialization: 'General Physician',
        currentStatus: 'available',
      });
    }
    res.json({ clinic });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/clinic - Update clinic info
router.patch('/', async (req, res) => {
  try {
    const { name, doctorName, specialization } = req.body;
    const clinic = await Clinic.findOneAndUpdate(
      {},
      { name, doctorName, specialization },
      { new: true }
    );
    res.json({ success: true, clinic });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/clinic/status - Update doctor status
router.patch('/status', async (req, res) => {
  try {
    const { currentStatus, statusReason } = req.body;
    const clinic = await Clinic.findOneAndUpdate(
      {},
      { currentStatus, statusReason: statusReason || '' },
      { new: true }
    );

    const io = req.app.get('io');
    if (io) io.emit('doctorStatusChanged', { status: currentStatus, reason: statusReason });

    res.json({ success: true, clinic });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clinic/qr - Get QR code for walk-in
router.get('/qr', async (req, res) => {
  try {
    const clinic = await Clinic.findOne();
    const clinicId = clinic?.clinicId || 'clinic_001';
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const walkInUrl = `${clientUrl}/clinic/${clinicId}`;

    const qrDataUrl = await QRCode.toDataURL(walkInUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    });

    res.json({ qrDataUrl, walkInUrl, clinicId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clinic/ml-health - Check ML service
router.get('/ml-health', async (req, res) => {
  try {
    const health = await checkHealth();
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
