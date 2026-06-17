
# 🏥 MediCare – AI-Powered Clinic Queue & Appointment Management System

MediCare is a full-stack clinic management platform that helps clinics manage appointments, walk-in patients, and waiting queues efficiently. It uses Machine Learning to predict consultation duration and provides real-time queue updates using Socket.IO.

---

## 🚀 Features

### 👨‍⚕️ Patient Portal

* Book appointments online
* Search appointments using phone number or Appointment ID
* Track queue position in real time
* View estimated waiting time
* Check doctor availability

### 🖥️ Receptionist Dashboard

* Manage appointments
* Add walk-in patients
* Call next patient
* Complete consultations
* Mark no-show patients
* Manage doctor schedules and breaks
* View analytics dashboard

### ⚡ Real-Time Updates

* Instant queue updates using Socket.IO
* No page refresh required
* Live synchronization between patient and receptionist portals

### 🤖 Machine Learning

* Predict consultation duration using Random Forest Regression
* Features used:

  * Age
  * Visit Type
  * First Visit / Follow-up
  * Day of Week
  * Time of Day
* Continuous learning using completed consultation history

---

## 🧠 Problem Statement

Many clinics still use paper tokens and fixed consultation slots. Patients often wait for long periods without knowing when they will be called, while receptionists manually manage appointments and walk-in patients.

MediCare solves this problem by providing intelligent appointment scheduling, real-time queue tracking, and AI-based consultation duration prediction.

---

## 🏗️ System Architecture

```text
Patient Portal / Receptionist Dashboard
                │
                ▼
      React + Vite + Tailwind CSS
                │
      REST API + Socket.IO
                │
                ▼
       Node.js + Express Server
                │
        ┌───────┴────────┐
        ▼                ▼
 MongoDB Atlas      ML Service
                     (FastAPI)
                        │
                 Random Forest
                        │
          Predicted Consultation Time
```

---

## 🤖 Machine Learning Pipeline

1. Patient books an appointment.
2. Features are extracted:

   * Age
   * Visit Type
   * First Visit
   * Day of Week
   * Time of Day
3. Random Forest predicts consultation duration.
4. Estimated waiting time is calculated.
5. Actual consultation duration is stored after completion.
6. Model can be retrained using real consultation data.

---

## ⚡ Socket.IO Events

| Event                 | Description                     |
| --------------------- | ------------------------------- |
| queueUpdated          | Queue state changes             |
| patientBooked         | Appointment booked              |
| walkInJoined          | Walk-in patient added           |
| callNextPatient       | Receptionist calls next patient |
| consultationCompleted | Consultation finished           |
| doctorStatusChanged   | Doctor availability changed     |
| scheduleUpdated       | Schedule modified               |
| modelRetrained        | ML model retrained              |

---

## 🗄️ Database Collections

* Patients
* Appointments
* Queue
* Clinic
* DoctorSchedule
* ConsultationHistory

---

## 🛠️ Tech Stack

### Frontend

* React
* Vite
* Tailwind CSS
* Socket.IO Client

### Backend

* Node.js
* Express.js
* Socket.IO

### Database

* MongoDB Atlas

### Machine Learning

* Python
* FastAPI
* Scikit-Learn
* Random Forest Regressor

---

## 🎯 Project Goal

MediCare aims to improve clinic efficiency by combining appointment booking, intelligent queue management, real-time updates, and machine-learning-based wait-time prediction into a single platform.


## Prerequisites
- Node.js 18+
- Python 3.8+
- MongoDB (local or Atlas)

---

## 1. Train the ML Model

```bash
cd ml-service
pip install -r requirements.txt
python train_model.py
```

Start the ML service:
```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

---

## 2. Start the Backend

Update `backend/.env` with your MongoDB URI if using Atlas:
```
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/medicare
```

```bash
cd backend
npm install
npm run dev
```

Backend runs on: http://localhost:5000

---

## 3. Start the Frontend

```bash
cd frontend
npm run dev
```

Frontend runs on: http://localhost:5173

---

## Access Points

| URL | Purpose |
|-----|---------|
| http://localhost:5173/ | Patient Home |
| http://localhost:5173/book | Book Appointment |
| http://localhost:5173/track | Track Appointment |
| http://localhost:5173/receptionist | Receptionist Dashboard |
| http://localhost:5173/clinic/clinic_001 | Walk-In Kiosk (QR target) |
| http://localhost:5000/health | Backend Health Check |
| http://localhost:8000/health | ML Service Health Check |
| http://localhost:8000/docs | ML Service Swagger UI |
