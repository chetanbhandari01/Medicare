const mongoose = require('mongoose');

const WorkingHourSchema = new mongoose.Schema({
  start: { type: String, required: true }, // "10:00"
  end: { type: String, required: true },   // "13:00"
}, { _id: false });

const BreakSchema = new mongoose.Schema({
  name: { type: String, default: 'Break' },
  start: { type: String, required: true }, // "13:00"
  end: { type: String, required: true },   // "14:00"
}, { _id: false });

const DoctorScheduleSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true }, // YYYY-MM-DD
  workingHours: { type: [WorkingHourSchema], default: [] },
  breaks: { type: [BreakSchema], default: [] },
  status: {
    type: String,
    enum: ['available', 'holiday', 'conference', 'half-day', 'unavailable'],
    default: 'available'
  },
  reason: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('DoctorSchedule', DoctorScheduleSchema);
