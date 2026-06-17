import { Routes, Route, Navigate } from 'react-router-dom'
import PatientHome from './pages/PatientHome'
import BookAppointment from './pages/BookAppointment'
import TrackAppointment from './pages/TrackAppointment'
import WalkInKiosk from './pages/WalkInKiosk'
import LiveQueue from './pages/LiveQueue'
import ReceptionistLogin from './pages/ReceptionistLogin'
import ReceptionistDashboard from './pages/ReceptionistDashboard'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      {/* Patient-facing routes */}
      <Route path="/"                     element={<PatientHome />} />
      <Route path="/book"                 element={<BookAppointment />} />
      <Route path="/track"                element={<TrackAppointment />} />
      <Route path="/clinic/:clinicId"     element={<WalkInKiosk />} />
      <Route path="/queue/:appointmentId" element={<LiveQueue />} />

      {/* Receptionist auth */}
      <Route path="/login"                element={<ReceptionistLogin />} />

      {/* Protected receptionist dashboard */}
      <Route
        path="/receptionist"
        element={
          <ProtectedRoute>
            <ReceptionistDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
