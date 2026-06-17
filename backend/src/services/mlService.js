/**
 * MediCare - ML Service Client
 * HTTP client for the Python FastAPI prediction service
 */
const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const FALLBACK_DURATIONS = {
  'General Consultation': 14,
  'Fever': 8,
  'Diabetes': 18,
  'Blood Pressure': 13,
  'Skin Consultation': 15,
  'Child Consultation': 19,
  'Follow-up': 9,
  'First Visit': 26,
};

/**
 * Predict consultation duration for a single patient
 */
async function predictDuration({ age, visitType, firstVisit, dayOfWeek, timeOfDay }) {
  try {
    const res = await axios.post(`${ML_SERVICE_URL}/predict`, {
      age: Number(age),
      visitType,
      firstVisit: Boolean(firstVisit),
      dayOfWeek,
      timeOfDay,
    }, { timeout: 5000 });

    return {
      predictedDuration: res.data.predictedDuration,
      confidenceRange: res.data.confidenceRange,
      source: 'ml',
    };
  } catch (err) {
    console.warn('ML service unavailable, using fallback duration:', err.message);
    const fallback = FALLBACK_DURATIONS[visitType] || 12;
    return {
      predictedDuration: fallback,
      confidenceRange: 4,
      source: 'fallback',
    };
  }
}

/**
 * Check if ML service is healthy
 */
async function checkHealth() {
  try {
    const res = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 3000 });
    return res.data;
  } catch {
    return { status: 'unavailable', model_loaded: false };
  }
}

module.exports = { predictDuration, checkHealth };
