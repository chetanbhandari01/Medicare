/**
 * MediCare - Queue Routes (Appointment-Time Ordered)
 */
const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const queueService = require('../services/queueService');
const { getTodayString } = require('../services/appointmentIdService');

// GET /api/queue — Get current queue state
router.get('/', async (req, res) => {
  try {
    const state = await queueService.getQueueState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/queue/gap-suggestion — Get dynamic gap-fill suggestion
router.get('/gap-suggestion', async (req, res) => {
  try {
    const state = await queueService.getQueueState();
    res.json({ gapSuggestion: state.gapSuggestion });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/queue/call-next — Call next patient (by earliest appointmentTime)
router.post('/call-next', async (req, res) => {
  try {
    const next = await queueService.callNextPatient();
    const state = await queueService.getQueueState();

    const io = req.app.get('io');
    if (io) {
      io.emit('callNextPatient', { patient: next });
      io.emit('queueUpdated', state);
    }

    res.json({ success: true, patient: next, queue: state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/queue/complete/:id — Complete consultation
router.post('/complete/:id', async (req, res) => {
  try {
    const patient = await queueService.completeConsultation(req.params.id);
    const state = await queueService.getQueueState();

    const io = req.app.get('io');
    if (io) {
      io.emit('consultationCompleted', { patient });
      io.emit('queueUpdated', state);
    }

    res.json({ success: true, patient, queue: state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/queue/checkin/:id — Check in a scheduled patient
router.post('/checkin/:id', async (req, res) => {
  try {
    const patient = await queueService.checkInPatient(req.params.id);
    const state = await queueService.getQueueState();

    const io = req.app.get('io');
    if (io) io.emit('queueUpdated', state);

    res.json({ success: true, patient, queue: state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/queue/no-show/:id — Mark patient as no-show
router.patch('/no-show/:id', async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(
      req.params.id, { status: 'no-show' }, { new: true }
    );
    const state = await queueService.getQueueState();

    const io = req.app.get('io');
    if (io) io.emit('queueUpdated', state);

    res.json({ success: true, patient, queue: state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/queue/late/:id — Mark patient as late (arrived past appointment time)
router.patch('/late/:id', async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(
      req.params.id, { status: 'late' }, { new: true }
    );
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const state = await queueService.getQueueState();

    const io = req.app.get('io');
    if (io) io.emit('queueUpdated', state);

    res.json({ success: true, patient, queue: state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/queue/skip/:id — Move a patient to after all current waiting patients
router.patch('/skip/:id', async (req, res) => {
  try {
    const today = getTodayString();
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // Find the latest appointmentTime among active patients, bump by 1 minute
    const last = await Patient.findOne(
      { appointmentDate: today, status: { $in: ['waiting', 'checked-in'] } },
      {},
      { sort: { appointmentTime: -1 } }
    );

    if (last && last._id.toString() !== req.params.id) {
      const [h, m] = last.appointmentTime.split(':').map(Number);
      const bumped = h * 60 + m + (last.predictedDuration || 10) + 1;
      const newH = Math.floor(bumped / 60);
      const newM = bumped % 60;
      const newTime = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
      await Patient.findByIdAndUpdate(req.params.id, { appointmentTime: newTime });
    }

    const state = await queueService.getQueueState();
    const io = req.app.get('io');
    if (io) io.emit('queueUpdated', state);

    res.json({ success: true, queue: state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/queue/:id — Remove patient from queue (cancel)
router.delete('/:id', async (req, res) => {
  try {
    await Patient.findByIdAndUpdate(req.params.id, { status: 'cancelled' });
    const state = await queueService.getQueueState();
    const io = req.app.get('io');
    if (io) io.emit('queueUpdated', state);
    res.json({ success: true, queue: state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
