const mongoose = require('mongoose');

const ClinicSchema = new mongoose.Schema({
  clinicId: { type: String, unique: true, required: true },
  name: { type: String, default: 'MediCare Clinic' },
  doctorName: { type: String, default: 'Dr. Sarah Johnson' },
  specialization: { type: String, default: 'General Physician' },
  currentStatus: {
    type: String,
    enum: ['available', 'break', 'unavailable', 'closed'],
    default: 'available'
  },
  statusReason: { type: String, default: '' },
  qrCodeUrl: { type: String, default: '' },
  // Default working hours (used as template for new schedule entries)
  defaultWorkingHours: {
    type: [{ start: String, end: String }],
    default: [
      { start: '10:00', end: '13:00' },
      { start: '14:00', end: '17:00' }
    ]
  },
  defaultBreaks: {
    type: [{ name: String, start: String, end: String }],
    default: [{ name: 'Lunch Break', start: '13:00', end: '14:00' }]
  },
}, { timestamps: true });

module.exports = mongoose.model('Clinic', ClinicSchema);
