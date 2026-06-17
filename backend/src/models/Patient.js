const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema({
  appointmentId: { type: String, unique: true, sparse: true },
  name: { type: String, required: true, trim: true },
  age: { type: Number, required: true, min: 0, max: 120 },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Other' },
  phone: { type: String, required: true, trim: true },
  visitType: {
    type: String,
    required: true,
    enum: [
      'General Consultation', 'Fever', 'Diabetes', 'Blood Pressure',
      'Skin Consultation', 'Child Consultation', 'Follow-up', 'First Visit'
    ]
  },
  source: { type: String, enum: ['appointment', 'walkin'], required: true },
  status: {
    type: String,
    enum: ['scheduled', 'checked-in', 'waiting', 'in-consultation', 'completed', 'cancelled', 'no-show', 'late'],
    default: 'scheduled'
  },

  predictedDuration: { type: Number, default: 10 },
  confidenceRange: { type: Number, default: 3 },
  appointmentDate: { type: String }, // YYYY-MM-DD
  appointmentTime: { type: String }, // HH:MM
  queuePosition: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  firstVisit: { type: Boolean, default: true },
  consultationStartTime: { type: Date },
  consultationEndTime: { type: Date },
  actualDuration: { type: Number },
  createdAt: { type: Date, default: Date.now },
});

PatientSchema.index({ phone: 1 });
PatientSchema.index({ appointmentDate: 1, status: 1 });

module.exports = mongoose.model('Patient', PatientSchema);
