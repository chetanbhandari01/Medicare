/**
 * MediCare - Appointment ID Generator
 * Generates unique IDs in format: MED-YYYY-XXXX
 */
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a unique appointment ID: MED-2026-AB12
 */
function generateAppointmentId() {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars (0,O,1,I)
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `MED-${year}-${suffix}`;
}

/**
 * Get time of day from hour
 */
function getTimeOfDay(hour) {
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

/**
 * Get day of week name from date
 */
function getDayOfWeek(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(date).getDay()];
}

/**
 * Convert "HH:MM" time string to minutes from midnight
 */
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Convert minutes from midnight to "HH:MM" string
 */
function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Format time to 12-hour display: "10:30 AM"
 */
function formatTime12h(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Get today's date as YYYY-MM-DD
 */
function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

module.exports = {
  generateAppointmentId,
  getTimeOfDay,
  getDayOfWeek,
  timeToMinutes,
  minutesToTime,
  formatTime12h,
  getTodayString,
};
