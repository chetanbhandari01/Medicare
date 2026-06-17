import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 15000,
})

// Attach JWT token to every request automatically
api.interceptors.request.use(config => {
  const token = localStorage.getItem('medicare_token')
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (username, pin) =>
  api.post('/auth/login', { username, pin }).then(r => r.data)
export const verifyToken = () =>
  api.post('/auth/verify').then(r => r.data)


// ── Clinic ────────────────────────────────────────────────────────────────────
export const getClinic = () => api.get('/clinic').then(r => r.data.clinic)
export const updateDoctorStatus = (status, reason) =>
  api.patch('/clinic/status', { currentStatus: status, statusReason: reason }).then(r => r.data)
export const getQRCode = () => api.get('/clinic/qr').then(r => r.data)
export const getMLHealth = () => api.get('/clinic/ml-health').then(r => r.data)
export const updateClinic = (data) => api.patch('/clinic', data).then(r => r.data)

// ── Appointments ──────────────────────────────────────────────────────────────
export const getSlots = (params) => api.get('/appointments/slots', { params }).then(r => r.data)
export const bookAppointment = (data) => api.post('/appointments', data).then(r => r.data)
export const searchAppointments = (params) => api.get('/appointments/search', { params }).then(r => r.data)
export const getAppointment = (id) => api.get(`/appointments/${id}`).then(r => r.data)
export const getAppointmentAhead = (id) => api.get(`/appointments/${id}/ahead`).then(r => r.data)
export const cancelAppointment = (id) => api.patch(`/appointments/${id}/cancel`).then(r => r.data)

export const getTodayAppointments = () => api.get('/appointments/today/all').then(r => r.data)

// ── Queue ─────────────────────────────────────────────────────────────────────
export const getQueue = () => api.get('/queue').then(r => r.data)
export const callNextPatient = () => api.post('/queue/call-next').then(r => r.data)
export const completeConsultation = (id) => api.post(`/queue/complete/${id}`).then(r => r.data)
export const checkinPatient = (id) => api.post(`/queue/checkin/${id}`).then(r => r.data)
export const markNoShow = (id) => api.patch(`/queue/no-show/${id}`).then(r => r.data)
export const markLate = (id) => api.patch(`/queue/late/${id}`).then(r => r.data)
export const skipPatient = (id) => api.patch(`/queue/skip/${id}`).then(r => r.data)
export const removeFromQueue = (id) => api.delete(`/queue/${id}`).then(r => r.data)


// ── Walk-In ───────────────────────────────────────────────────────────────────
export const joinWalkIn = (data) => api.post('/walkin/receptionist-add', data).then(r => r.data)
export const addWalkInReceptionist = (data) => api.post('/walkin/receptionist-add', data).then(r => r.data)
export const getNextWalkInSlot = (params) => api.get('/walkin/next-slot', { params }).then(r => r.data)

// ── Schedule ──────────────────────────────────────────────────────────────────
export const getSchedule = (date) => api.get(`/schedule/${date}`).then(r => r.data)
export const updateSchedule = (date, data) => api.put(`/schedule/${date}`, data).then(r => r.data)
export const getScheduleRange = (from, to) => api.get(`/schedule/range/${from}/${to}`).then(r => r.data)

// ── Analytics ─────────────────────────────────────────────────────────────────
export const getAnalytics    = () => api.get('/analytics/today').then(r => r.data)
export const getHistory      = (days) => api.get('/analytics/history', { params: { days } }).then(r => r.data)

// ── Learning / Model Improvement ─────────────────────────────────────────────
export const getLearningStats = () => api.get('/learning/stats').then(r => r.data)
export const triggerRetrain   = () => api.post('/learning/retrain').then(r => r.data)
