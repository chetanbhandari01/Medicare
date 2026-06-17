const mongoose = require('mongoose');

const ConsultationHistorySchema = new mongoose.Schema({
  patientId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  appointmentId:     { type: String },
  visitType:         { type: String },
  age:               { type: Number },
  firstVisit:        { type: Boolean },
  appointmentSource: { type: String, enum: ['appointment', 'walkin'], default: 'appointment' },
  doctorId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', default: null },
  startTime:         { type: Date },
  endTime:           { type: Date },
  actualDuration:    { type: Number }, // minutes
  predictedDuration: { type: Number },
  predictionError:   { type: Number }, // actualDuration - predictedDuration
  dayOfWeek:         { type: String },
  timeOfDay:         { type: String },
  date:              { type: String }, // YYYY-MM-DD
}, { timestamps: true });

// Indexes for efficient learning queries
ConsultationHistorySchema.index({ date: 1 });
ConsultationHistorySchema.index({ visitType: 1 });
ConsultationHistorySchema.index({ appointmentSource: 1 });

module.exports = mongoose.model('ConsultationHistory', ConsultationHistorySchema);
