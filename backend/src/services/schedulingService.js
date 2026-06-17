/**
 * MediCare - Dynamic Scheduling Service
 * Generates available time slots based on working hours, breaks, and ML predictions
 */
const Patient = require('../models/Patient');
const DoctorSchedule = require('../models/DoctorSchedule');
const mlService = require('./mlService');
const {
  timeToMinutes,
  minutesToTime,
  getDayOfWeek,
  getTimeOfDay,
} = require('./appointmentIdService');

const MIN_SLOT_GAP = 5; // minimum gap between slots in minutes

/**
 * Get or create schedule entry for a date
 */
async function getScheduleForDate(dateStr, clinic) {
  let schedule = await DoctorSchedule.findOne({ date: dateStr });
  if (!schedule) {
    // Use clinic defaults
    schedule = await DoctorSchedule.create({
      date: dateStr,
      workingHours: clinic.defaultWorkingHours,
      breaks: clinic.defaultBreaks,
      status: 'available',
    });
  }
  return schedule;
}

/**
 * Check if a time (in minutes) falls within any break period
 */
function isDuringBreak(minutesMidnight, breaks) {
  return breaks.some(b => {
    const start = timeToMinutes(b.start);
    const end = timeToMinutes(b.end);
    return minutesMidnight >= start && minutesMidnight < end;
  });
}

/**
 * Generate available appointment slots for a given date and visit type
 */
async function getAvailableSlots(dateStr, visitType, age, firstVisit, clinic) {
  const schedule = await getScheduleForDate(dateStr, clinic);

  if (schedule.status !== 'available') {
    return {
      available: false,
      reason: schedule.reason || `Doctor unavailable: ${schedule.status}`,
      slots: [],
    };
  }

  const dayOfWeek = getDayOfWeek(dateStr);

  // Fetch existing appointments for that date (booked slots)
  const existingAppointments = await Patient.find({
    appointmentDate: dateStr,
    status: { $nin: ['cancelled', 'no-show'] },
  }).select('appointmentTime predictedDuration');

  // Build occupied windows: [startMin, endMin]
  const occupiedWindows = existingAppointments.map(a => {
    const startMin = timeToMinutes(a.appointmentTime);
    const endMin = startMin + (a.predictedDuration || 10);
    return { start: startMin, end: endMin };
  });

  // Get ML prediction for this patient's visit
  const hour = new Date().getHours();
  const timeOfDay = getTimeOfDay(hour);
  const prediction = await mlService.predictDuration({
    age,
    visitType,
    firstVisit,
    dayOfWeek,
    timeOfDay,
  });
  const slotDuration = prediction.predictedDuration;

  // ── Past-slot guard ──────────────────────────────────────────────────────
  // If booking for today, don't show slots that have already passed.
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
  const isToday = dateStr === todayStr;
  let nowMinutes = 0;
  if (isToday) {
    const now = new Date();
    nowMinutes = now.getHours() * 60 + now.getMinutes() + 15; // +15 min buffer
  }

  const availableSlots = [];

  // Iterate over working hour windows
  for (const wh of schedule.workingHours) {
    let cursor = timeToMinutes(wh.start);
    const windowEnd = timeToMinutes(wh.end);

    // For today, skip the cursor forward past the current time
    if (isToday && cursor < nowMinutes) {
      cursor = nowMinutes;
      // Round up to the nearest slot boundary (multiples of slotDuration + gap)
      const slotStep = slotDuration + MIN_SLOT_GAP;
      const whStart = timeToMinutes(wh.start);
      if (slotStep > 0) {
        const elapsed = cursor - whStart;
        const steps = Math.ceil(elapsed / slotStep);
        cursor = whStart + steps * slotStep;
      }
    }

    while (cursor + slotDuration <= windowEnd) {
      const slotEnd = cursor + slotDuration;

      // Skip if during break
      if (isDuringBreak(cursor, schedule.breaks)) {
        // Jump to end of break
        const activeBreak = schedule.breaks.find(b =>
          cursor >= timeToMinutes(b.start) && cursor < timeToMinutes(b.end)
        );
        if (activeBreak) {
          cursor = timeToMinutes(activeBreak.end);
          continue;
        }
      }

      // Skip if overlaps with existing appointment
      const overlaps = occupiedWindows.some(w =>
        cursor < w.end && slotEnd > w.start
      );

      if (!overlaps) {
        const slotTimeOfDay = getTimeOfDay(Math.floor(cursor / 60));
        availableSlots.push({
          time: minutesToTime(cursor),
          displayTime: formatTime12h(minutesToTime(cursor)),
          predictedDuration: slotDuration,
          confidenceRange: prediction.confidenceRange,
          timeOfDay: slotTimeOfDay,
        });
      }

      cursor += slotDuration + MIN_SLOT_GAP;
    }
  }

  return {
    available: true,
    slots: availableSlots,
    predictedDuration: slotDuration,
    confidenceRange: prediction.confidenceRange,
  };
}

function formatTime12h(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

module.exports = { getAvailableSlots, getScheduleForDate };
