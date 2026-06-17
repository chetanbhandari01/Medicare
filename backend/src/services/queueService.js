/**
 * MediCare - Queue Service (Appointment-Time Ordered)
 * Queue ordering is driven by appointmentTime, not arrival order.
 */
const Patient = require('../models/Patient');
const ConsultationHistory = require('../models/ConsultationHistory');
const { getTodayString, getDayOfWeek, getTimeOfDay, timeToMinutes, minutesToTime, formatTime12h } = require('./appointmentIdService');

/** Statuses that are "active" in today's queue */
const ACTIVE_STATUSES = ['checked-in', 'waiting', 'in-consultation', 'late'];

/**
 * Get the full queue state for today, ordered by appointmentTime.
 */
async function getQueueState() {
  const today = getTodayString();

  const currentPatient = await Patient.findOne({
    appointmentDate: today,
    status: 'in-consultation',
  });

  // Active queue: checked-in + waiting, sorted by appointment time
  const waitingPatients = await Patient.find({
    appointmentDate: today,
    status: { $in: ['checked-in', 'waiting'] },
  }).sort({ appointmentTime: 1 });

  // Late patients (not yet acted on)
  const latePatients = await Patient.find({
    appointmentDate: today,
    status: 'late',
  }).sort({ appointmentTime: 1 });

  const completedPatients = await Patient.find({
    appointmentDate: today,
    status: 'completed',
  }).sort({ appointmentTime: 1 });

  const scheduledPatients = await Patient.find({
    appointmentDate: today,
    status: 'scheduled',
  }).sort({ appointmentTime: 1 });

  // Total wait = sum of predicted durations for all waiting patients
  const totalWaitMinutes = waitingPatients.reduce(
    (sum, p) => sum + (p.predictedDuration || 10), 0
  );

  // Compute per-patient expected consultation time
  // = now + cumulative durations of patients ahead
  const now = new Date();
  let cursor = now.getTime();

  // If a patient is currently in consultation, account for their remaining time
  if (currentPatient) {
    const start = currentPatient.consultationStartTime || now;
    const elapsedMs = now - start;
    const elapsedMin = elapsedMs / 60000;
    const remaining = Math.max(0, (currentPatient.predictedDuration || 10) - elapsedMin);
    cursor += remaining * 60000;
  }

  const waitingWithETA = waitingPatients.map((p) => {
    const eta = new Date(cursor);
    cursor += (p.predictedDuration || 10) * 60000;
    return {
      ...p.toObject(),
      expectedConsultationTime: eta.toISOString(),
    };
  });

  // Gap suggestion
  const gapSuggestion = await getGapSuggestion(currentPatient, waitingPatients, scheduledPatients);

  return {
    currentPatient,
    waitingPatients: waitingWithETA,
    latePatients,
    completedPatients,
    scheduledPatients,
    totalWaitMinutes,
    expectedConsultationTime: new Date(now.getTime() + totalWaitMinutes * 60000).toISOString(),
    queueLength: waitingPatients.length,
    gapSuggestion,
  };
}

/**
 * Check a scheduled patient in (status → checked-in / waiting).
 * No position assignment — ordering is by appointmentTime.
 */
async function checkInPatient(patientId) {
  const patient = await Patient.findByIdAndUpdate(
    patientId,
    { status: 'waiting' },
    { new: true }
  );
  return patient;
}

/**
 * Register a walk-in via receptionist with a pre-computed appointmentTime.
 * patient object already has appointmentTime set by the scheduling logic.
 */
async function addWalkInToQueue(patient) {
  patient.status = 'waiting';
  await patient.save();
  return patient;
}

/**
 * Call next patient (move to in-consultation).
 * Selects by earliest appointmentTime among checked-in/waiting patients.
 */
async function callNextPatient() {
  const today = getTodayString();

  // Complete current if any
  const current = await Patient.findOne({
    appointmentDate: today,
    status: 'in-consultation',
  });

  if (current) {
    const endTime = new Date();
    const startTime = current.consultationStartTime || endTime;
    const actualDuration = Math.round((endTime - startTime) / 60000);

    await Patient.findByIdAndUpdate(current._id, {
      status: 'completed',
      consultationEndTime: endTime,
      actualDuration,
    });

    await ConsultationHistory.create({
      patientId:         current._id,
      appointmentId:     current.appointmentId,
      visitType:         current.visitType,
      age:               current.age,
      firstVisit:        current.firstVisit,
      appointmentSource: current.source || 'appointment',
      startTime,
      endTime,
      actualDuration,
      predictedDuration: current.predictedDuration,
      predictionError:   actualDuration - (current.predictedDuration || 0),
      dayOfWeek:         getDayOfWeek(today),
      timeOfDay:         getTimeOfDay(new Date().getHours()),
      date:              today,
    });
  }

  // Get next waiting patient by earliest appointmentTime
  const next = await Patient.findOne(
    { appointmentDate: today, status: { $in: ['waiting', 'checked-in'] } },
    {},
    { sort: { appointmentTime: 1 } }
  );

  if (!next) return null;

  await Patient.findByIdAndUpdate(next._id, {
    status: 'in-consultation',
    consultationStartTime: new Date(),
  });

  return await Patient.findById(next._id);
}

/**
 * Complete current consultation manually.
 */
async function completeConsultation(patientId) {
  const today = getTodayString();
  const patient = await Patient.findById(patientId);
  if (!patient) throw new Error('Patient not found');

  const endTime = new Date();
  const startTime = patient.consultationStartTime || endTime;
  const actualDuration = Math.round((endTime - startTime) / 60000);

  await Patient.findByIdAndUpdate(patientId, {
    status: 'completed',
    consultationEndTime: endTime,
    actualDuration,
  });

  await ConsultationHistory.create({
    patientId:         patient._id,
    appointmentId:     patient.appointmentId,
    visitType:         patient.visitType,
    age:               patient.age,
    firstVisit:        patient.firstVisit,
    appointmentSource: patient.source || 'appointment',
    startTime,
    endTime,
    actualDuration,
    predictedDuration: patient.predictedDuration,
    predictionError:   actualDuration - (patient.predictedDuration || 0),
    dayOfWeek:         getDayOfWeek(today),
    timeOfDay:         getTimeOfDay(new Date().getHours()),
    date:              today,
  });

  return await Patient.findById(patientId);
}

/**
 * Calculate wait time for a specific patient based on appointment-time ordering.
 * Returns total minutes to wait = sum of predicted durations of patients with
 * earlier appointment times who are still active.
 */
async function calculateWaitTime(patientId) {
  const today = getTodayString();
  const patient = await Patient.findById(patientId);
  if (!patient) return 0;

  const patientsAhead = await Patient.find({
    appointmentDate: today,
    status: { $in: ['waiting', 'checked-in', 'in-consultation'] },
    appointmentTime: { $lt: patient.appointmentTime },
  });

  return patientsAhead.reduce((sum, p) => sum + (p.predictedDuration || 10), 0);
}

/**
 * Count how many patients are ahead of a patient in the queue.
 */
async function countPatientsAhead(patientId) {
  const today = getTodayString();
  const patient = await Patient.findById(patientId);
  if (!patient) return 0;

  // If patient is not in active queue yet, count all waiting patients
  if (!['waiting', 'checked-in'].includes(patient.status)) {
    const scheduledAhead = await Patient.countDocuments({
      appointmentDate: today,
      status: { $in: ['waiting', 'checked-in', 'scheduled'] },
      appointmentTime: { $lt: patient.appointmentTime },
    });
    return scheduledAhead;
  }

  return await Patient.countDocuments({
    appointmentDate: today,
    status: { $in: ['waiting', 'checked-in'] },
    appointmentTime: { $lt: patient.appointmentTime },
  });
}

/**
 * Dynamic gap filling: check if current consultation finishes early
 * and a waiting walk-in fits in the gap before the next appointment.
 *
 * Returns { walkIn, gapMinutes, nextAppointmentTime } or null.
 */
async function getGapSuggestion(currentPatient, waitingPatients, scheduledPatients) {
  if (!currentPatient) return null;

  const now = new Date();
  const startTime = currentPatient.consultationStartTime || now;
  const elapsedMin = (now - startTime) / 60000;
  const predictedEnd = (currentPatient.predictedDuration || 10);
  const remainingMin = Math.max(0, predictedEnd - elapsedMin);

  // Find next scheduled (not yet checked-in) appointment
  const today = getTodayString();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Next upcoming appointment time
  const nextScheduled = [...scheduledPatients, ...waitingPatients]
    .filter(p => p._id.toString() !== currentPatient._id.toString())
    .sort((a, b) => timeToMinutes(a.appointmentTime) - timeToMinutes(b.appointmentTime))
    .find(p => timeToMinutes(p.appointmentTime) > nowMinutes);

  if (!nextScheduled) return null;

  const nextApptMinutes = timeToMinutes(nextScheduled.appointmentTime);
  const estimatedEndMinutes = nowMinutes + remainingMin;
  const gapMinutes = Math.floor(nextApptMinutes - estimatedEndMinutes);

  if (gapMinutes < 3) return null; // Too small a gap

  // Find a waiting walk-in that fits in the gap
  const fittingWalkIn = waitingPatients.find(p =>
    p.source === 'walkin' &&
    (p.predictedDuration || 10) <= gapMinutes
  );

  if (!fittingWalkIn) return null;

  return {
    walkIn: fittingWalkIn,
    gapMinutes,
    nextAppointmentTime: nextScheduled.appointmentTime,
    nextAppointmentDisplay: formatTime12h(nextScheduled.appointmentTime),
  };
}

/**
 * Get today's analytics.
 */
async function getTodayAnalytics() {
  const today = getTodayString();
  const patients = await Patient.find({ appointmentDate: today });

  const total = patients.length;
  const appointments = patients.filter(p => p.source === 'appointment').length;
  const walkIns = patients.filter(p => p.source === 'walkin').length;
  const completed = patients.filter(p => p.status === 'completed').length;
  const noShows = patients.filter(p => p.status === 'no-show').length;
  const cancelled = patients.filter(p => p.status === 'cancelled').length;
  const waiting = patients.filter(p => ['waiting', 'checked-in'].includes(p.status)).length;

  const completedPatients = patients.filter(p => p.status === 'completed' && p.actualDuration);
  const avgWait = completedPatients.length > 0
    ? Math.round(completedPatients.reduce((s, p) => s + p.actualDuration, 0) / completedPatients.length)
    : 0;

  const longestWait = completedPatients.length > 0
    ? Math.max(...completedPatients.map(p => p.actualDuration))
    : 0;
  const shortestWait = completedPatients.length > 0
    ? Math.min(...completedPatients.map(p => p.actualDuration))
    : 0;

  const heatmap = {};
  for (let h = 9; h <= 17; h++) {
    heatmap[h] = { count: 0, consultationLoad: 0 };
  }
  patients.forEach(p => {
    if (p.appointmentTime) {
      const hour = parseInt(p.appointmentTime.split(':')[0]);
      if (heatmap[hour] !== undefined) {
        heatmap[hour].count++;
        heatmap[hour].consultationLoad += p.predictedDuration || 10;
      }
    }
  });

  // Utilization: total actual minutes / working minutes (assume 7h = 420min)
  const totalActualMinutes = completedPatients.reduce((s, p) => s + (p.actualDuration || 0), 0);
  const workingMinutes = 420;
  const utilization = Math.round((totalActualMinutes / workingMinutes) * 100);

  return {
    total, appointments, walkIns, completed, noShows, cancelled, waiting,
    avgWait, longestWait, shortestWait, heatmap, totalActualMinutes, workingMinutes, utilization,
  };
}

module.exports = {
  getQueueState,
  checkInPatient,
  addWalkInToQueue,
  callNextPatient,
  completeConsultation,
  calculateWaitTime,
  countPatientsAhead,
  getTodayAnalytics,
  getGapSuggestion,
};
