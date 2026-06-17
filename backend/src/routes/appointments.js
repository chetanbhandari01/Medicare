const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Clinic = require('../models/Clinic');
const mlService = require('../services/mlService');
const schedulingService = require('../services/schedulingService');
const queueService = require('../services/queueService');
const { generateAppointmentId, getDayOfWeek, getTimeOfDay, getTodayString } = require('../services/appointmentIdService');


// GET /api/appointments/slots?date=YYYY-MM-DD&visitType=...&age=...&firstVisit=true
router.get('/slots', async (req, res) => {
  try {
    const { date, visitType, age, firstVisit } = req.query;
    if (!date || !visitType || !age) {
      return res.status(400).json({ error: 'date, visitType, and age are required' });
    }
    const clinic = await Clinic.findOne();
    if (!clinic) return res.status(404).json({ error: 'Clinic not found' });

    const result = await schedulingService.getAvailableSlots(
      date, visitType, parseInt(age), firstVisit === 'true', clinic
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/appointments - Book appointment
router.post('/', async (req, res) => {
  try {
    const { name, age, gender, phone, visitType, appointmentDate, appointmentTime, notes, firstVisit } = req.body;

    if (!name || !age || !phone || !visitType || !appointmentDate || !appointmentTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check for duplicate slot
    const existing = await Patient.findOne({
      appointmentDate,
      appointmentTime,
      status: { $nin: ['cancelled', 'no-show'] },
    });
    if (existing) {
      return res.status(409).json({ error: 'This time slot is already booked. Please choose another.' });
    }

    // Generate unique appointment ID
    let appointmentId;
    let attempts = 0;
    do {
      appointmentId = generateAppointmentId();
      attempts++;
    } while (await Patient.findOne({ appointmentId }) && attempts < 10);

    // Get ML prediction
    const dayOfWeek = getDayOfWeek(appointmentDate);
    const hour = parseInt(appointmentTime.split(':')[0]);
    const timeOfDay = getTimeOfDay(hour);

    const prediction = await mlService.predictDuration({
      age: parseInt(age),
      visitType,
      firstVisit: firstVisit === true || firstVisit === 'true',
      dayOfWeek,
      timeOfDay,
    });

    const patient = await Patient.create({
      appointmentId,
      name,
      age: parseInt(age),
      gender: gender || 'Other',
      phone,
      visitType,
      source: 'appointment',
      status: 'scheduled',
      predictedDuration: prediction.predictedDuration,
      confidenceRange: prediction.confidenceRange,
      appointmentDate,
      appointmentTime,
      notes: notes || '',
      firstVisit: firstVisit === true || firstVisit === 'true',
    });

    // Emit via socket
    const io = req.app.get('io');
    if (io) {
      io.emit('patientBooked', {
        appointmentId: patient.appointmentId,
        name: patient.name,
        time: patient.appointmentTime,
        date: patient.appointmentDate,
        visitType: patient.visitType,
      });
    }

    res.status(201).json({
      success: true,
      patient,
      prediction,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/appointments/search?phone=...
router.get('/search', async (req, res) => {
  try {
    const { phone, appointmentId } = req.query;
    if (!phone && !appointmentId) {
      return res.status(400).json({ error: 'phone or appointmentId required' });
    }

    let patients;
    if (appointmentId) {
      patients = await Patient.find({ appointmentId: appointmentId.toUpperCase() });
    } else {
      patients = await Patient.find({ phone }).sort({ createdAt: -1 });
    }

    res.json({ patients });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/appointments/:id - Get single appointment
router.get('/:id', async (req, res) => {
  try {
    const patient = await Patient.findOne({
      $or: [
        { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null },
        { appointmentId: req.params.id.toUpperCase() },
      ]
    });
    if (!patient) return res.status(404).json({ error: 'Appointment not found' });

    // Calculate patients ahead by appointment time ordering
    const patientsAhead = await queueService.countPatientsAhead(patient._id.toString());

    // Calculate expected consultation time
    const waitMinutes = await queueService.calculateWaitTime(patient._id.toString());
    const expectedConsultationTime = new Date(Date.now() + waitMinutes * 60000).toISOString();

    res.json({ patient, patientsAhead, waitMinutes, expectedConsultationTime });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/appointments/:id/cancel
router.patch('/:id/cancel', async (req, res) => {
  try {
    const patient = await Patient.findOneAndUpdate(
      { appointmentId: req.params.id.toUpperCase() },
      { status: 'cancelled' },
      { new: true }
    );
    if (!patient) return res.status(404).json({ error: 'Appointment not found' });

    const io = req.app.get('io');
    if (io) io.emit('appointmentCancelled', { appointmentId: patient.appointmentId });

    res.json({ success: true, patient });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/appointments/today/all - All today's appointments (for receptionist)
router.get('/today/all', async (req, res) => {
  try {
    const today = getTodayString();
    const patients = await Patient.find({ appointmentDate: today }).sort({ appointmentTime: 1, queuePosition: 1 });
    res.json({ patients });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/appointments/:id/ahead - Queue timeline for this appointment
router.get('/:id/ahead', async (req, res) => {
  try {
    const patient = await Patient.findOne({
      $or: [
        { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null },
        { appointmentId: req.params.id.toUpperCase() },
      ]
    });
    if (!patient) return res.status(404).json({ error: 'Appointment not found' });

    const today = getTodayString();

    // Who is currently in the room?
    const currentlyIn = await Patient.findOne({
      appointmentDate: today,
      status: 'in-consultation',
    }).select('name visitType appointmentTime predictedDuration source');

    // Patients physically in the waiting area before this patient's slot
    // - excludes 'scheduled' (not yet arrived) and 'in-consultation' (shown as currentlyIn above)
    // - excludes the patient themselves
    const ahead = await Patient.find({
      appointmentDate: today,
      status: { $in: ['checked-in', 'waiting', 'late'] },
      appointmentTime: { $lt: patient.appointmentTime },
      _id: { $ne: patient._id },
    })
      .select('name visitType appointmentTime predictedDuration source status')
      .sort({ appointmentTime: 1 });

    // Also get the full ordered list of all today's active appointments for the timeline
    // This includes scheduled (not yet arrived) so the patient can see their position
    const timeline = await Patient.find({
      appointmentDate: today,
      status: { $in: ['scheduled', 'checked-in', 'waiting', 'late', 'in-consultation'] },
      appointmentTime: { $lte: patient.appointmentTime },
    })
      .select('name visitType appointmentTime predictedDuration source status _id')
      .sort({ appointmentTime: 1 });

    res.json({ ahead, currentlyIn, timeline, total: ahead.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
