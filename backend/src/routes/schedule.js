/**
 * MediCare - Schedule Routes
 */
const express = require('express');
const router = express.Router();
const DoctorSchedule = require('../models/DoctorSchedule');
const Clinic = require('../models/Clinic');

// GET /api/schedule/:date
router.get('/:date', async (req, res) => {
  try {
    const clinic = await Clinic.findOne();
    let schedule = await DoctorSchedule.findOne({ date: req.params.date });
    if (!schedule && clinic) {
      schedule = {
        date: req.params.date,
        workingHours: clinic.defaultWorkingHours,
        breaks: clinic.defaultBreaks,
        status: 'available',
        reason: '',
      };
    }
    res.json({ schedule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/schedule/:date - Update schedule for a date
router.put('/:date', async (req, res) => {
  try {
    const { workingHours, breaks, status, reason } = req.body;
    const schedule = await DoctorSchedule.findOneAndUpdate(
      { date: req.params.date },
      { workingHours, breaks, status, reason },
      { upsert: true, new: true }
    );

    const io = req.app.get('io');
    if (io) io.emit('scheduleUpdated', { date: req.params.date, schedule });

    res.json({ success: true, schedule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schedule/range/:from/:to - Get schedule for date range
router.get('/range/:from/:to', async (req, res) => {
  try {
    const schedules = await DoctorSchedule.find({
      date: { $gte: req.params.from, $lte: req.params.to },
    });
    res.json({ schedules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/schedule/doctor-status - Update doctor's live status
router.patch('/doctor-status', async (req, res) => {
  try {
    const { status, reason } = req.body;
    const clinic = await Clinic.findOneAndUpdate(
      {},
      { currentStatus: status, statusReason: reason || '' },
      { new: true }
    );

    const io = req.app.get('io');
    if (io) io.emit('doctorStatusChanged', { status, reason });

    res.json({ success: true, clinic });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
