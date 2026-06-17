# MediCare — Case Study
### AI-Powered Clinic Management & Intelligent Queue System

---

## 1. Problem Statement

Clinics running on paper-based or fixed-slot scheduling systems face chronic inefficiencies. Patients endure unpredictable wait times, receptionists struggle to manage walk-ins alongside pre-booked appointments, and no-shows leave gaps that waste doctor time.

The core pain: **static 15-minute time slots don't reflect real-world consultation variance.** A first-time patient with a complex condition takes far longer than a routine follow-up — yet the system treats them identically, causing cascading delays that frustrate patients and staff across every appointment that follows.

---

## 2. Solution Overview

MediCare is an AI-powered clinic management system that replaces static scheduling with **dynamic, ML-predicted appointment durations**. It manages pre-booked appointments and walk-in patients in a single unified queue, with real-time updates pushed to all connected devices via WebSockets.

### Key Features

| Feature | Description |
|---|---|
| 🤖 AI Duration Prediction | ML model predicts consultation length per patient at booking time |
| ⚡ Real-Time Queue | Socket.IO pushes live updates — no refresh needed |
| 🏥 Walk-In Integration | Walk-ins merge seamlessly into the appointment queue |
| 🔁 Continuous Learning | Completed consultations retrain the model over time |
| 📊 Clinic Analytics | Receptionist dashboard with queue metrics & history |
| 🔐 Secure Auth | JWT-based login for clinic staff |

---

## 3. System Architecture

MediCare follows a **three-tier architecture** with a dedicated ML microservice.

![System Architecture](docs/images/architecture_diagram.png)

### Tier Breakdown

#### 🖥️ Frontend — React + Vite + TailwindCSS

| Page | Role |
|---|---|
| `PatientHome.jsx` | Landing page with navigation |
| `BookAppointment.jsx` | Multi-step booking form with dynamic slot availability |
| `TrackAppointment.jsx` | Live queue position & wait time tracker |
| `WalkInKiosk.jsx` | Self-registration form for walk-in patients |
| `ReceptionistDashboard.jsx` | Full clinic control panel (queue, analytics, status) |
| `ReceptionistLogin.jsx` | JWT-authenticated login for staff |

#### ⚙️ Backend — Node.js + Express + MongoDB + Socket.IO

- **REST API** routes: `/api/auth`, `/api/appointments`, `/api/queue`, `/api/walkin`, `/api/schedule`, `/api/analytics`, `/api/clinic`, `/api/learning`
- **WebSocket server** (Socket.IO) broadcasts live events to all connected clients
- **Mongoose models**: `Patient`, `Clinic`, `DoctorSchedule`, `ConsultationHistory`
- **ML client**: HTTP bridge to the Python prediction service with fallback durations

#### 🧠 ML Service — Python + FastAPI + Scikit-Learn

- Exposes `/predict`, `/predict-batch`, `/retrain`, `/health`, `/model-info`
- Random Forest model (200 estimators)
- Atomic model swap on retrain — zero downtime

---

## 4. ML Prediction Pipeline

Every time a patient books an appointment, a prediction is generated **before** the slot is confirmed.

![ML Prediction Pipeline](docs/images/ml_pipeline.png)

### Input Features

| Feature | Type | Example |
|---|---|---|
| `age` | Integer | 45 |
| `visitType` | Categorical (8 types) | `"Diabetes"` |
| `firstVisit` | Boolean | `true` |
| `dayOfWeek` | Categorical | `"Monday"` |
| `timeOfDay` | Categorical | `"Morning"` |

### Visit Type Fallback Durations (when ML service is unavailable)

| Visit Type | Fallback (min) |
|---|---|
| First Visit | 26 |
| Child Consultation | 19 |
| Diabetes | 18 |
| General Consultation | 14 |
| Blood Pressure | 13 |
| Skin Consultation | 15 |
| Fever | 8 |
| Follow-up | 9 |

### Model Performance

| Metric | Value |
|---|---|
| R² Score | **0.714** |
| MAE | **2.59 minutes** |
| Training Samples | 480 (synthetic + real blended) |
| Estimators | 200 decision trees |

> Confidence range (± minutes) is calculated from the standard deviation across all 200 tree predictions.

### Continuous Learning Loop

```
Consultation completes
       ↓
Backend records actualDuration
       ↓
POST /api/learning/retrain → sends real records to /retrain
       ↓
Python blends real + synthetic data → retrains Random Forest
       ↓
New model.pkl saved atomically → loaded into memory
       ↓
io.emit('modelRetrained', { accuracy, samples, timestamp })
```

---

## 5. Real-Time Socket Event Flow

All live updates are pushed via Socket.IO — no polling, no page refresh needed.

![Socket.IO Real-Time Event Flow](docs/images/socket_flow.png)

### Complete Event Reference

| Event | Direction | Trigger | Payload |
|---|---|---|---|
| `queueUpdated` | Server → All | Any queue change | Full queue state |
| `patientBooked` | Server → All | New appointment booked | `{ appointmentId, name, time, date, visitType }` |
| `appointmentCancelled` | Server → All | Appointment deleted | `{ appointmentId }` |
| `walkInJoined` | Server → All | Walk-in registered | `{ patient, slot }` |
| `callNextPatient` | Server → All | Receptionist calls next | `{ patient }` |
| `consultationCompleted` | Server → All | Consultation marked done | `{ patient }` |
| `doctorStatusChanged` | Server → All | Doctor status updated | `{ status, reason }` |
| `scheduleUpdated` | Server → All | Schedule modified | `{ date, schedule }` |
| `modelRetrained` | Server → All | ML model retrained | `{ accuracy, samples, timestamp }` |
| `requestQueueUpdate` | Client → Server | Client asks for refresh | *(none)* |

---

## 6. Data Model

![MongoDB Data Model](docs/images/data_model.png)

### Patient Schema (Core Entity)

```js
{
  appointmentId:         String,  // unique, e.g. "AP-X4K2"
  name:                  String,
  age:                   Number,  // 0–120
  gender:                enum,    // Male | Female | Other
  phone:                 String,
  visitType:             enum,    // 8 types
  source:                enum,    // appointment | walkin
  status:                enum,    // scheduled | checked-in | waiting |
                                  // in-consultation | completed |
                                  // cancelled | no-show | late
  predictedDuration:     Number,  // minutes (from ML)
  confidenceRange:       Number,  // ± minutes
  appointmentDate:       String,  // YYYY-MM-DD
  appointmentTime:       String,  // HH:MM
  firstVisit:            Boolean,
  consultationStartTime: Date,
  consultationEndTime:   Date,
  actualDuration:        Number,  // recorded after completion → feeds /retrain
}
```

### Patient Status State Machine

```
scheduled → checked-in → waiting → in-consultation → completed
    ↓            ↓           ↓
 cancelled     late       no-show
```

---

## 7. UI Screens

### Receptionist Dashboard

![Receptionist Dashboard — Live Queue + Analytics](docs/images/receptionist_dashboard.png)

The dashboard is the command center for clinic staff. It shows:
- **Live Queue Panel** — every patient card with status badge, visit type, predicted duration, and action buttons (Call Next, Complete, Skip, No Show, Late)
- **Gap Suggestion** — `GET /api/queue/gap-suggestion` identifies idle time in the schedule
- **Analytics Panel** — consultation type breakdown, average duration, day totals
- **Doctor Status Toggle** — mark doctor as Available / Break / Unavailable (broadcasts `doctorStatusChanged`)

### Patient Booking & Tracking

![Patient Booking & Appointment Tracking Screens](docs/images/patient_screens.png)

- **Book Appointment** — Form collects name, age, phone, visit type, date. Calls `GET /api/appointments/slots` to show available time slots with their ML-predicted durations so patients can make an informed choice.
- **Track Appointment** — Patient enters their appointment ID or phone number. Shows live queue position, estimated wait, and a timeline of who's ahead — all updated in real time via `queueUpdated` socket events.

---

## 8. API Reference

### Appointments

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/appointments/slots` | Available slots with predicted durations |
| `POST` | `/api/appointments` | Book appointment (triggers ML prediction) |
| `GET` | `/api/appointments/search` | Search by phone or appointmentId |
| `GET` | `/api/appointments/:id` | Single appointment + wait time |
| `GET` | `/api/appointments/:id/ahead` | Timeline of patients ahead |
| `PATCH` | `/api/appointments/:id/cancel` | Cancel appointment |
| `GET` | `/api/appointments/today/all` | All today's appointments |

### Queue Management

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/queue` | Full queue state |
| `POST` | `/api/queue/call-next` | Call next patient into consultation |
| `POST` | `/api/queue/complete/:id` | Mark consultation done |
| `POST` | `/api/queue/checkin/:id` | Check in a patient |
| `PATCH` | `/api/queue/no-show/:id` | Mark no-show |
| `PATCH` | `/api/queue/late/:id` | Mark arrived-late |
| `PATCH` | `/api/queue/skip/:id` | Move patient to end of queue |
| `DELETE` | `/api/queue/:id` | Remove from queue |

### ML Service

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/predict` | Single consultation duration prediction |
| `POST` | `/predict-batch` | Batch predictions for slot generation |
| `POST` | `/retrain` | Retrain model with real + synthetic data |
| `GET` | `/health` | Service health + model status |
| `GET` | `/model-info` | Full model metadata & metrics |

---

## 9. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React + Vite | Fast dev experience, component-based UI |
| Styling | TailwindCSS | Rapid utility-first styling |
| Backend | Node.js + Express | Non-blocking I/O, ideal for real-time apps |
| Database | MongoDB + Mongoose | Flexible schema for evolving patient data |
| Real-Time | Socket.IO | Reliable WebSocket with automatic fallback |
| ML Runtime | Python + FastAPI | Fast async API, native Scikit-Learn support |
| ML Model | Random Forest | Accurate on tabular data, interpretable |
| Auth | JWT | Stateless, scalable authentication |

---

## 10. Results & Outcomes

- ✅ Dynamic ML-predicted durations replace rigid fixed-slot scheduling
- ✅ R² = **0.714**, MAE = **2.59 min** — predictions within ~3 minutes on average
- ✅ Real-time WebSocket updates across all devices — zero polling
- ✅ Receptionist dashboard centralizes all queue operations in one view
- ✅ Continuous retraining loop improves the model with real clinic data over time
- ✅ Fallback duration system keeps the app functional even if ML service goes down

---

## 11. What I'd Do Differently

1. **Real clinic data first** — Collect real consultation data before training instead of relying on synthetic samples
2. **Role-based access early** — Design RBAC into the architecture from day one, not retrofit it
3. **Design system upfront** — Establish component tokens before building pages to avoid UI inconsistency
4. **End-to-end tests from the start** — Not an afterthought after core features are built
