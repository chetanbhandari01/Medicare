/**
 * MediCare - Walk-In Routes (Receptionist-Controlled)
 * Walk-in patients are registered only by the receptionist.
 * The system computes the next available slot after all existing appointments.
 */
const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Clinic = require('../models/Clinic');
const mlService = require('../services/mlService');
const queueService = require('../services/queueService');
const schedulingService = require('../services/schedulingService');
const { getDayOfWeek, getTimeOfDay, getTodayString, timeToMinutes, minutesToTime, formatTime12h } = require('../services/appointmentIdService');

/**
 * Compute the next available walk-in slot by scanning all existing appointments
 * for today and finding the first open gap after all booked slots.
 * Returns { appointmentTime, displayTime, estimatedWaitMinutes }
 */
async function computeNextWalkInSlot(predictedDuration, clinic) {
  const today = getTodayString();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Fetch all active patients today (not cancelled/no-show)
  const existingPatients = await Patient.find({
    appointmentDate: today,
    status: { $nin: ['cancelled', 'no-show'] },
  }).select('appointmentTime predictedDuration').sort({ appointmentTime: 1 });

  // Build occupied windows: [startMin, endMin]
  const occupied = existingPatients.map(p => {
    const start = timeToMinutes(p.appointmentTime);
    return { start, end: start + (p.predictedDuration || 10) };
  });

  // Working hours from clinic or schedule
  let workingHours = clinic.defaultWorkingHours || [
    { start: '10:00', end: '13:00' },
    { start: '14:00', end: '17:00' },
  ];

  // Try to get today's schedule override
  try {
    const DoctorSchedule = require('../models/DoctorSchedule');
    const sched = await DoctorSchedule.findOne({ date: today });
    if (sched && sched.workingHours?.length) {
      workingHours = sched.workingHours;
    }
  } catch (_) {}

  const MIN_GAP = 5; // minutes buffer between appointments

  for (const wh of workingHours) {
    const whStart = timeToMinutes(wh.start);
    const whEnd = timeToMinutes(wh.end);

    // Start searching from either the start of window or now+1min (whichever is later)
    let cursor = Math.max(whStart, nowMinutes + 1);

    while (cursor + predictedDuration <= whEnd) {
      const slotEnd = cursor + predictedDuration;

      // Check if slot overlaps any occupied window (with buffer)
      const overlaps = occupied.some(w =>
        cursor < w.end + MIN_GAP && slotEnd > w.start - MIN_GAP
      );

      if (!overlaps) {
        const timeStr = minutesToTime(cursor);
        const estimatedWaitMinutes = cursor - nowMinutes;
        return {
          appointmentTime: timeStr,
          displayTime: formatTime12h(timeStr),
          estimatedWaitMinutes: Math.max(0, estimatedWaitMinutes),
        };
      }

      // Advance cursor past the overlapping window
      const blocking = occupied
        .filter(w => cursor < w.end + MIN_GAP && slotEnd > w.start - MIN_GAP)
        .sort((a, b) => b.end - a.end)[0];

      cursor = blocking ? blocking.end + MIN_GAP : cursor + 1;
    }
  }

  // No slot found — append at end of last working window
  const lastWindow = workingHours[workingHours.length - 1];
  const fallbackTime = minutesToTime(timeToMinutes(lastWindow.end));
  return {
    appointmentTime: fallbackTime,
    displayTime: formatTime12h(fallbackTime),
    estimatedWaitMinutes: timeToMinutes(lastWindow.end) - nowMinutes,
  };
}

// GET /api/walkin/next-slot — Preview next available slot (no patient created)
router.get('/next-slot', async (req, res) => {
  try {
    const { visitType = 'General Consultation', age = 30 } = req.query;
    const today = getTodayString();
    const now = new Date();
    const dayOfWeek = getDayOfWeek(today);
    const timeOfDay = getTimeOfDay(now.getHours());

    const clinic = await Clinic.findOne();
    if (!clinic) return res.status(404).json({ error: 'Clinic not found' });

    const prediction = await mlService.predictDuration({
      age: parseInt(age),
      visitType,
      firstVisit: true,
      dayOfWeek,
      timeOfDay,
    });

    const slot = await computeNextWalkInSlot(prediction.predictedDuration, clinic);

    res.json({
      ...slot,
      predictedDuration: prediction.predictedDuration,
      confidenceRange: prediction.confidenceRange,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/walkin/receptionist-add — Receptionist registers a walk-in patient
router.post('/receptionist-add', async (req, res) => {
  try {
    const { name, age, phone, visitType } = req.body;
    if (!name || !age || !phone || !visitType) {
      return res.status(400).json({ error: 'name, age, phone, visitType required' });
    }

    const today = getTodayString();
    const now = new Date();
    const dayOfWeek = getDayOfWeek(today);
    const timeOfDay = getTimeOfDay(now.getHours());

    const clinic = await Clinic.findOne();
    if (!clinic) return res.status(404).json({ error: 'Clinic not found' });

    // Predict duration
    const prediction = await mlService.predictDuration({
      age: parseInt(age),
      visitType,
      firstVisit: true,
      dayOfWeek,
      timeOfDay,
    });

    // Compute next available slot
    const slot = await computeNextWalkInSlot(prediction.predictedDuration, clinic);

    // Create patient with assigned slot time
    const patient = new Patient({
      name,
      age: parseInt(age),
      phone,
      visitType,
      source: 'walkin',
      status: 'waiting',
      predictedDuration: prediction.predictedDuration,
      confidenceRange: prediction.confidenceRange,
      appointmentDate: today,
      appointmentTime: slot.appointmentTime,
      firstVisit: true,
    });

    await queueService.addWalkInToQueue(patient);

    // Count patients ahead by appointment time
    const patientsAhead = await Patient.countDocuments({
      appointmentDate: today,
      status: { $in: ['waiting', 'checked-in'] },
      appointmentTime: { $lt: slot.appointmentTime },
    });

    const state = await queueService.getQueueState();

    const io = req.app.get('io');
    if (io) {
      io.emit('walkInJoined', { patient, slot });
      io.emit('queueUpdated', state);
    }

    res.status(201).json({
      success: true,
      patient,
      slot,
      patientsAhead,
      estimatedWaitMinutes: slot.estimatedWaitMinutes,
      prediction,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/walkin/pending — Get pending walk-ins
router.get('/pending', async (req, res) => {
  try {
    const today = getTodayString();
    const pending = await Patient.find({
      appointmentDate: today,
      source: 'walkin',
      status: { $in: ['waiting', 'checked-in'] },
    }).sort({ appointmentTime: 1 });
    res.json({ patients: pending });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/walkin/join — Legacy kiosk endpoint (kept for backward compat, routes to receptionist-add logic)
router.post('/join', async (req, res) => {
  // Redirect to receptionist-add logic
  req.url = '/receptionist-add';
  router.handle(req, res);
});

module.exports = router;
