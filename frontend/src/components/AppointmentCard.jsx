import { Clock, User, Timer, XCircle, CalendarClock } from 'lucide-react'

const STATUS_CONFIG = {
  scheduled:         { label: 'Scheduled',        cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  'checked-in':      { label: 'Checked In',        cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  waiting:           { label: 'Waiting',           cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  'in-consultation': { label: 'In Consultation',   cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  completed:         { label: 'Completed',         cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  cancelled:         { label: 'Cancelled',         cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  'no-show':         { label: 'No Show',           cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  late:              { label: 'Late',              cls: 'bg-orange-600/20 text-orange-300 border-orange-600/30' },
}

export default function AppointmentCard({ patient, patientsAhead, expectedConsultationTime, showActions, onCancel }) {
  const st = STATUS_CONFIG[patient.status] || STATUS_CONFIG.scheduled

  return (
    <div className="glass p-5 rounded-2xl animate-scale-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs text-slate-500 mb-1">Appointment ID</div>
          <div className="text-lg font-bold text-brand-400 tracking-wider font-mono">
            {patient.appointmentId}
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${st.cls}`}>
          {patient.status === 'in-consultation' && <span className="pulse-dot green w-1.5 h-1.5" />}
          {st.label}
        </span>
      </div>

      {/* Patient Info Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <InfoItem icon={User} label="Patient" value={patient.name} />
        <InfoItem label="Age / Gender" value={`${patient.age} yrs · ${patient.gender}`} />
        <InfoItem label="Visit Type" value={patient.visitType} />
        <InfoItem icon={Clock} label="Date" value={patient.appointmentDate} />
        <InfoItem label="Appt Time" value={fmt12(patient.appointmentTime)} />
        <InfoItem label="Source" value={patient.source === 'walkin' ? '🚶 Walk-In' : '📅 Appointment'} />
      </div>

      {/* Prediction */}
      <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-3 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Timer className="w-4 h-4 text-brand-400" />
          <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">AI Prediction</span>
        </div>
        <div className="flex items-center gap-4 text-sm flex-wrap">
          <div>
            <span className="text-slate-500">Duration: </span>
            <span className="font-semibold text-white">{patient.predictedDuration} min</span>
            <span className="text-slate-500"> ±{patient.confidenceRange} min</span>
          </div>
          {typeof patientsAhead === 'number' && (
            <div>
              <span className="text-slate-500">Ahead: </span>
              <span className="font-semibold text-white">{patientsAhead}</span>
            </div>
          )}
        </div>
      </div>

      {/* Expected Consultation Time */}
      {expectedConsultationTime && (
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 mb-4 flex items-center gap-3">
          <CalendarClock className="w-4 h-4 text-indigo-400 shrink-0" />
          <div>
            <div className="text-xs text-slate-500">Expected Consultation Time</div>
            <div className="text-sm font-semibold text-indigo-300">
              {new Date(expectedConsultationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {patient.notes && (
        <div className="text-xs text-slate-500 mb-4">
          📝 {patient.notes}
        </div>
      )}

      {/* Actions */}
      {showActions && onCancel && !['completed', 'cancelled', 'no-show'].includes(patient.status) && (
        <button onClick={() => onCancel(patient.appointmentId)} className="btn-danger text-xs">
          <XCircle className="w-3.5 h-3.5" />
          Cancel Appointment
        </button>
      )}
    </div>
  )
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-0.5 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className="text-sm font-medium text-slate-200">{value || '—'}</div>
    </div>
  )
}

function fmt12(timeStr) {
  if (!timeStr) return '—'
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`
}
