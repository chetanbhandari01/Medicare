/**
 * MediCare - Main Express + Socket.IO Server
 */
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const authRouter = require('./routes/auth');
const appointmentsRouter = require('./routes/appointments');
const queueRouter = require('./routes/queue');
const walkinRouter = require('./routes/walkin');
const scheduleRouter = require('./routes/schedule');
const analyticsRouter = require('./routes/analytics');
const clinicRouter = require('./routes/clinic');
const learningRouter = require('./routes/learning');

const app = express();
const server = http.createServer(app);

// ── CORS Origins ──────────────────────────────────────────────────────────────
// CLIENT_URL can be a comma-separated list: "https://app.vercel.app,http://localhost:5173"
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

function corsOriginCheck(origin, callback) {
  // Allow requests with no origin (mobile apps, Postman, health checks)
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes(origin)) return callback(null, true);
  callback(new Error(`Origin ${origin} not allowed by CORS`));
}

// ── Socket.IO Setup ───────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    credentials: true,
  },
});

app.set('io', io);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: corsOriginCheck, credentials: true }));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/queue', queueRouter);
app.use('/api/walkin', walkinRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/clinic', clinicRouter);
app.use('/api/learning', learningRouter);

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── Socket.IO Events ──────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });

  // Client can request queue refresh
  socket.on('requestQueueUpdate', async () => {
    try {
      const queueService = require('./services/queueService');
      const state = await queueService.getQueueState();
      socket.emit('queueUpdated', state);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });
});
// ── MongoDB Connection ────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in .env — check your backend/.env file');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');

    // Seed clinic if not exists
    const Clinic = require('./models/Clinic');
    const existing = await Clinic.findOne();
    if (!existing) {
      await Clinic.create({
        clinicId: process.env.CLINIC_ID || 'clinic_001',
        name: 'MediCare Clinic',
        doctorName: 'Dr. Hiralal Pawar',
        specialization: 'General Physician',
        currentStatus: 'available',
      });
      console.log('🏥 Clinic seeded');
    }

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 MediCare Server running on http://localhost:${PORT}`);
      console.log(`🔌 Socket.IO ready`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

module.exports = { app, server, io };
