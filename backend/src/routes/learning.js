/**
 * MediCare - Learning Routes
 * Surfaces consultation history stats and triggers model retraining.
 * Mounted at /api/learning
 */
const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const ConsultationHistory = require('../models/ConsultationHistory');

const ML_SERVICE_URL    = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const RETRAIN_THRESHOLD = parseInt(process.env.RETRAIN_THRESHOLD) || 50;

// ── GET /api/learning/stats ────────────────────────────────────────────────────
// Returns aggregated consultation history stats + current model metadata.
router.get('/stats', async (req, res) => {
  try {
    const allRecords = await ConsultationHistory.find({}).sort({ createdAt: -1 });
    const totalRealRecords = allRecords.length;

    // ── Per-visit-type aggregation ─────────────────────────────────────────────
    const visitTypeMap = {};
    allRecords.forEach(r => {
      const vt = r.visitType || 'Unknown';
      if (!visitTypeMap[vt]) {
        visitTypeMap[vt] = {
          visitType:       vt,
          count:           0,
          totalActual:     0,
          totalPredicted:  0,
          totalError:      0,
          absErrorSum:     0,
        };
      }
      const entry = visitTypeMap[vt];
      entry.count++;
      entry.totalActual    += r.actualDuration    || 0;
      entry.totalPredicted += r.predictedDuration || 0;
      entry.totalError     += r.predictionError   != null ? r.predictionError : ((r.actualDuration || 0) - (r.predictedDuration || 0));
      entry.absErrorSum    += Math.abs(r.predictionError != null ? r.predictionError : ((r.actualDuration || 0) - (r.predictedDuration || 0)));
    });

    const byVisitType = Object.values(visitTypeMap).map(e => ({
      visitType:    e.visitType,
      count:        e.count,
      avgActual:    e.count ? Math.round((e.totalActual    / e.count) * 10) / 10 : 0,
      avgPredicted: e.count ? Math.round((e.totalPredicted / e.count) * 10) / 10 : 0,
      avgError:     e.count ? Math.round((e.totalError     / e.count) * 10) / 10 : 0,
      mae:          e.count ? Math.round((e.absErrorSum    / e.count) * 10) / 10 : 0,
    })).sort((a, b) => b.count - a.count);

    // ── Recent 20 records ──────────────────────────────────────────────────────
    const recentRecords = allRecords.slice(0, 20).map(r => ({
      _id:               r._id,
      date:              r.date,
      visitType:         r.visitType,
      age:               r.age,
      firstVisit:        r.firstVisit,
      appointmentSource: r.appointmentSource,
      actualDuration:    r.actualDuration,
      predictedDuration: r.predictedDuration,
      predictionError:   r.predictionError ?? ((r.actualDuration || 0) - (r.predictedDuration || 0)),
      startTime:         r.startTime,
      endTime:           r.endTime,
    }));

    // ── Overall accuracy ───────────────────────────────────────────────────────
    const recordsWithBoth = allRecords.filter(r => r.actualDuration && r.predictedDuration);
    const overallMAE = recordsWithBoth.length
      ? Math.round((recordsWithBoth.reduce((s, r) =>
          s + Math.abs((r.actualDuration || 0) - (r.predictedDuration || 0)), 0
        ) / recordsWithBoth.length) * 10) / 10
      : null;

    // ── Model info from ML service ─────────────────────────────────────────────
    let modelInfo = null;
    try {
      const mlRes  = await axios.get(`${ML_SERVICE_URL}/model-info`, { timeout: 5000 });
      modelInfo    = mlRes.data;
    } catch {
      modelInfo    = { error: 'ML service unavailable' };
    }

    // ── Retrain readiness ──────────────────────────────────────────────────────
    const recordsSinceLastTrain = modelInfo?.real_samples != null
      ? Math.max(0, totalRealRecords - (modelInfo.real_samples || 0))
      : totalRealRecords;

    const readyToRetrain = totalRealRecords >= 10;  // minimum safety floor

    res.json({
      totalRealRecords,
      retrainThreshold:       RETRAIN_THRESHOLD,
      readyToRetrain,
      recordsSinceLastTrain,
      byVisitType,
      recentRecords,
      overallMAE,
      modelInfo,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/learning/retrain ────────────────────────────────────────────────
// Fetches all ConsultationHistory, sends to ML service /retrain.
router.post('/retrain', async (req, res) => {
  try {
    const allRecords = await ConsultationHistory.find({ actualDuration: { $gt: 0 } });

    if (allRecords.length === 0) {
      return res.status(400).json({
        error: 'No consultation history available for retraining.',
      });
    }

    // Format for ML service
    const records = allRecords.map(r => ({
      age:            r.age            || 30,
      visitType:      r.visitType      || 'General Consultation',
      firstVisit:     r.firstVisit     ?? true,
      dayOfWeek:      r.dayOfWeek      || 'Monday',
      timeOfDay:      r.timeOfDay      || 'Morning',
      actualDuration: r.actualDuration || 10,
    }));

    const mlRes = await axios.post(
      `${ML_SERVICE_URL}/retrain`,
      { records },
      { timeout: 120000 } // retraining can take up to 2 min
    );

    // Emit socket event so connected dashboards refresh
    const io = req.app.get('io');
    if (io) {
      io.emit('modelRetrained', {
        real_samples:  mlRes.data.real_samples,
        r2_score:      mlRes.data.r2_score,
        mae_minutes:   mlRes.data.mae_minutes,
        last_trained:  mlRes.data.last_trained,
        data_source:   mlRes.data.data_source,
      });
    }

    res.json({
      success: true,
      message: `Retraining complete. Model now trained on ${mlRes.data.total_samples} samples (${mlRes.data.real_samples} real).`,
      ...mlRes.data,
    });
  } catch (err) {
    const detail = err.response?.data?.detail || err.message;
    res.status(500).json({ error: `Retraining failed: ${detail}` });
  }
});

// ── GET /api/learning/history-export ─────────────────────────────────────────
// Full export of ConsultationHistory (for inspection / debugging).
router.get('/history-export', async (req, res) => {
  try {
    const records = await ConsultationHistory.find({}).sort({ date: -1, startTime: -1 });
    res.json({ count: records.length, records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
