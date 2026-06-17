/**
 * MediCare - Analytics Routes
 */
const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const ConsultationHistory = require('../models/ConsultationHistory');
const queueService = require('../services/queueService');
const { getTodayString } = require('../services/appointmentIdService');

// GET /api/analytics/today
router.get('/today', async (req, res) => {
  try {
    const data = await queueService.getTodayAnalytics();
    const today = getTodayString();

    // Doctor utilization
    const completed = await ConsultationHistory.find({ date: today });
    const totalActualMinutes = completed.reduce((s, c) => s + (c.actualDuration || 0), 0);
    const workingMinutes = 7 * 60; // 7 hours default
    const utilization = workingMinutes > 0 ? Math.min(100, Math.round((totalActualMinutes / workingMinutes) * 100)) : 0;

    // Longest/shortest wait
    const completedWithDuration = completed.filter(c => c.actualDuration);
    const longestWait = completedWithDuration.length > 0 ? Math.max(...completedWithDuration.map(c => c.actualDuration)) : 0;
    const shortestWait = completedWithDuration.length > 0 ? Math.min(...completedWithDuration.map(c => c.actualDuration)) : 0;

    // Expected finish time
    const queueState = await queueService.getQueueState();
    const remainingLoad = queueState.waitingPatients.reduce((s, p) => s + (p.predictedDuration || 10), 0);
    const finishTime = new Date(Date.now() + remainingLoad * 60000);

    res.json({
      ...data,
      utilization,
      longestWait,
      shortestWait,
      expectedFinishTime: finishTime.toISOString(),
      totalActualMinutes,
      workingMinutes,
      currentQueueLength: queueState.queueLength,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/history?days=7
router.get('/history', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const from = new Date();
    from.setDate(from.getDate() - days);
    const fromStr = from.toISOString().split('T')[0];

    const history = await ConsultationHistory.find({
      date: { $gte: fromStr },
    });

    // Group by date
    const byDate = {};
    history.forEach(h => {
      if (!byDate[h.date]) byDate[h.date] = { count: 0, totalDuration: 0 };
      byDate[h.date].count++;
      byDate[h.date].totalDuration += h.actualDuration || 0;
    });

    res.json({ history: byDate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
