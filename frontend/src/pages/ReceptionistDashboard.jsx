import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard, Users, Calendar, BarChart2,
  PhoneCall, CheckCircle2, XCircle, SkipForward, Trash2,
  UserPlus, Clock, Activity, ChevronDown, ChevronUp, Timer,
  Stethoscope, Coffee, AlertTriangle, RefreshCw, User,
  BarChart3, Loader2, Heart, LogOut, Zap, ClockAlert,
  Brain, TrendingUp, Database, FlaskConical, Sparkles, ChevronRight,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import DoctorStatusBadge from '../components/DoctorStatusBadge'
import { useSocket } from '../hooks/useSocket'
import {
  getClinic, getQueue, updateDoctorStatus, callNextPatient,
  completeConsultation, markNoShow, markLate, skipPatient, removeFromQueue,
  checkinPatient, getTodayAppointments, getAnalytics,
  getSchedule, updateSchedule, getScheduleRange,
  addWalkInReceptionist, getNextWalkInSlot,
  getLearningStats, triggerRetrain,
} from '../services/api'
import { format, addDays } from 'date-fns'

const TABS = [
  { id: 'dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { id: 'queue',      label: 'Queue',       icon: Users },
  { id: 'schedule',   label: 'Schedule',    icon: Calendar },
  { id: 'analytics',  label: 'Analytics',   icon: BarChart2 },
  { id: 'learning',   label: 'Learning',    icon: Brain },
]

const VISIT_TYPES = [
  'General Consultation', 'Fever', 'Diabetes', 'Blood Pressure',
  'Skin Consultation', 'Child Consultation', 'Follow-up', 'First Visit',
]

export default function ReceptionistDashboard() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('dashboard')
  const qc = useQueryClient()

  const storedUser = localStorage.getItem('medicare_user') || 'Receptionist'

  const handleLogout = () => {
    localStorage.removeItem('medicare_token')
    localStorage.removeItem('medicare_user')
    navigate('/login', { replace: true })
  }

  const { data: clinic, isLoading: cLoading } = useQuery({ queryKey: ['clinic'], queryFn: getClinic, refetchInterval: 30000 })
  const { data: queue, isLoading: qLoading } = useQuery({ queryKey: ['queue'], queryFn: getQueue, refetchInterval: 8000 })
  const { data: analytics } = useQuery({ queryKey: ['analytics'], queryFn: getAnalytics, refetchInterval: 30000 })
  const { data: appts }     = useQuery({ queryKey: ['today-appts'], queryFn: getTodayAppointments })
  const { data: learning, refetch: refetchLearning } = useQuery({
    queryKey: ['learning'],
    queryFn:  getLearningStats,
    enabled:  tab === 'learning',
    refetchInterval: tab === 'learning' ? 60000 : false,
  })


  // Socket updates
  useSocket('queueUpdated',          () => { qc.invalidateQueries({ queryKey: ['queue'] }); qc.invalidateQueries({ queryKey: ['analytics'] }) })
  useSocket('patientBooked',         () => { qc.invalidateQueries({ queryKey: ['today-appts'] }); qc.invalidateQueries({ queryKey: ['queue'] }) })
  useSocket('walkInJoined',          () => { qc.invalidateQueries({ queryKey: ['queue'] }); toast.success('Walk-in patient added to queue!') })
  useSocket('doctorStatusChanged',   () => qc.invalidateQueries({ queryKey: ['clinic'] }))
  useSocket('consultationCompleted', () => { qc.invalidateQueries({ queryKey: ['queue'] }); qc.invalidateQueries({ queryKey: ['analytics'] }); qc.invalidateQueries({ queryKey: ['learning'] }) })
  useSocket('modelRetrained',        () => { qc.invalidateQueries({ queryKey: ['learning'] }); toast.success('Model retrained successfully!') })

  const statusMut = useMutation({
    mutationFn: ({ status, reason }) => updateDoctorStatus(status, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clinic'] }); toast.success('Status updated') },
  })

  const callNext  = useMutation({ mutationFn: callNextPatient, onSuccess: () => { qc.invalidateQueries({ queryKey: ['queue'] }); toast.success('Next patient called!') }, onError: err => toast.error(err.response?.data?.error || 'Error') })
  const complete  = useMutation({ mutationFn: completeConsultation, onSuccess: () => qc.invalidateQueries({ queryKey: ['queue'] }), onError: err => toast.error(err.message) })
  const noShow    = useMutation({ mutationFn: markNoShow, onSuccess: () => { qc.invalidateQueries({ queryKey: ['queue'] }); toast('Marked as no-show') } })
  const late      = useMutation({ mutationFn: markLate,  onSuccess: () => { qc.invalidateQueries({ queryKey: ['queue'] }); toast('Marked as late') } })
  const skip      = useMutation({ mutationFn: skipPatient, onSuccess: () => qc.invalidateQueries({ queryKey: ['queue'] }) })
  const remove    = useMutation({ mutationFn: removeFromQueue, onSuccess: () => qc.invalidateQueries({ queryKey: ['queue'] }) })
  const checkin   = useMutation({ mutationFn: checkinPatient, onSuccess: () => { qc.invalidateQueries({ queryKey: ['queue'] }); toast.success('Patient checked in!') } })

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-16 sm:w-56 glass-dark border-r border-white/5 z-40 flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-500 flex items-center justify-center shrink-0">
            <Heart className="w-4 h-4 text-white" fill="white" />
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-bold gradient-text">MediCare</div>
            <div className="text-xs text-slate-500">Receptionist</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${tab === id ? 'bg-brand-500/20 text-brand-400 border border-brand-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
              <Icon className="w-5 h-5 shrink-0" />
              <span className="hidden sm:block">{label}</span>
            </button>
          ))}
        </nav>

        {/* Doctor Status + Logout */}
        <div className="p-3 border-t border-white/5 space-y-3">
          <div className="hidden sm:flex items-center gap-2 px-1">
            <div className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center shrink-0">
              <span className="text-brand-400 text-xs font-bold">{storedUser[0].toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-300 truncate">{storedUser}</div>
              <div className="text-xs text-slate-600">Receptionist</div>
            </div>
          </div>
          <div className="hidden sm:block text-xs text-slate-500 mb-1 px-1">Doctor Status</div>
          <div className="flex justify-center sm:justify-start px-1">
            <DoctorStatusBadge status={clinic?.currentStatus || 'available'} size="sm" />
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="hidden sm:block">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-16 sm:ml-56 flex-1 p-4 sm:p-6 min-w-0">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-6 pt-2">
          <div>
            <h1 className="text-xl font-bold text-white">{TABS.find(t => t.id === tab)?.label}</h1>
            <p className="text-xs text-slate-500">{clinic?.doctorName} · {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          </div>
          {/* Quick Status Buttons */}
          <div className="flex items-center gap-2">
            <button onClick={() => statusMut.mutate({ status: 'available' })}  className="btn-success text-xs px-3 py-1.5 hidden sm:flex"><Activity className="w-3.5 h-3.5" /> Available</button>
            <button onClick={() => statusMut.mutate({ status: 'break' })}      className="btn-amber text-xs px-3 py-1.5 hidden sm:flex"><Coffee className="w-3.5 h-3.5" /> Break</button>
            <button onClick={() => statusMut.mutate({ status: 'unavailable' })} className="btn-danger text-xs px-3 py-1.5 hidden sm:flex"><XCircle className="w-3.5 h-3.5" /> Unavailable</button>
          </div>
        </div>

        {tab === 'dashboard' && <DashboardTab queue={queue} analytics={analytics} clinic={clinic} callNext={callNext} complete={complete} />}
        {tab === 'queue'     && <QueueTab queue={queue} callNext={callNext} complete={complete} noShow={noShow} late={late} skip={skip} remove={remove} checkin={checkin} qc={qc} />}
        {tab === 'schedule'  && <ScheduleTab clinic={clinic} qc={qc} />}
        {tab === 'analytics' && <AnalyticsTab analytics={analytics} />}
        {tab === 'learning'  && <LearningTab learning={learning} refetchLearning={refetchLearning} />}
      </main>
    </div>
  )
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab({ queue, analytics, clinic, callNext, complete }) {
  const cur = queue?.currentPatient

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label="Patients Today"    value={analytics?.total || 0}       color="text-white" />
        <StatBox label="Completed"         value={analytics?.completed || 0}    color="text-emerald-400" />
        <StatBox label="Waiting"           value={queue?.queueLength || 0}      color="text-amber-400" />
        <StatBox label="No Shows"          value={analytics?.noShows || 0}      color="text-red-400" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label="Appointments"      value={analytics?.appointments || 0} color="text-brand-400" />
        <StatBox label="Walk-Ins"          value={analytics?.walkIns || 0}      color="text-indigo-400" />
        <StatBox label="Avg Duration"      value={`${analytics?.avgWait || 0}m`} color="text-slate-300" />
        <StatBox label="Utilization"       value={`${analytics?.utilization || 0}%`} color="text-teal-400" />
      </div>

      {/* Action Row */}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => callNext.mutate()} disabled={callNext.isPending} className="btn-primary">
          {callNext.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />}
          Call Next Patient
        </button>
        {cur && (
          <button onClick={() => complete.mutate(cur._id)} disabled={complete.isPending} className="btn-success">
            <CheckCircle2 className="w-4 h-4" /> Complete Consultation
          </button>
        )}
      </div>

      {/* Current Patient */}
      {cur ? (
        <div className="glass p-5 rounded-xl border border-emerald-500/20 animate-scale-in">
          <div className="flex items-center gap-2 mb-3">
            <span className="pulse-dot green" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">In Consultation</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Stethoscope className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="flex-1">
              <div className="text-lg font-bold text-white">{cur.name}</div>
              <div className="text-sm text-slate-400">{cur.visitType} · Age {cur.age} · {fmt12(cur.appointmentTime)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Predicted</div>
              <div className="text-xl font-bold text-emerald-400">{cur.predictedDuration} min</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass p-5 rounded-xl text-center text-slate-500">
          <Stethoscope className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No patient currently in consultation
        </div>
      )}

      {/* Waiting Queue Preview */}
      {queue?.waitingPatients?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-white mb-3 text-sm">Next Up ({queue.waitingPatients.length})</h3>
          <div className="space-y-2">
            {queue.waitingPatients.slice(0, 5).map((p, i) => (
              <div key={p._id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <div className="w-16 text-xs font-mono text-brand-400 shrink-0">{fmt12(p.appointmentTime)}</div>
                <div className="flex-1"><div className="text-sm font-medium text-slate-200">{p.name}</div><div className="text-xs text-slate-500">{p.visitType}</div></div>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${p.source === 'walkin' ? 'bg-amber-500/20 text-amber-400' : 'bg-brand-500/20 text-brand-400'}`}>
                  {p.source === 'walkin' ? '🚶' : '📅'}
                </span>
                <div className="text-xs text-slate-500">{p.predictedDuration}min</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Queue Tab ─────────────────────────────────────────────────────────────────
function QueueTab({ queue, callNext, complete, noShow, late, skip, remove, checkin, qc }) {
  const [showWalkInModal, setShowWalkInModal] = useState(false)

  const allPatients = [
    ...(queue?.currentPatient ? [queue.currentPatient] : []),
    ...(queue?.waitingPatients || []),
    ...(queue?.scheduledPatients || []),
    ...(queue?.latePatients || []),
  ].sort((a, b) => {
    const timeA = a.appointmentTime || '99:99'
    const timeB = b.appointmentTime || '99:99'
    return timeA.localeCompare(timeB)
  })

  const gapSuggestion = queue?.gapSuggestion
  const latePatients = queue?.latePatients || []

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Action Bar */}
      <div className="flex flex-wrap gap-3 mb-2">
        <button onClick={() => callNext.mutate()} disabled={callNext.isPending} className="btn-primary text-sm">
          {callNext.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PhoneCall className="w-3.5 h-3.5" />} Call Next
        </button>
        {queue?.currentPatient && (
          <button onClick={() => complete.mutate(queue.currentPatient._id)} className="btn-success text-sm">
            <CheckCircle2 className="w-3.5 h-3.5" /> Complete
          </button>
        )}
        <button
          onClick={() => setShowWalkInModal(true)}
          className="btn-amber text-sm ml-auto"
        >
          <UserPlus className="w-3.5 h-3.5" /> Add Walk-In
        </button>
      </div>

      {/* Gap Fill Suggestion Banner */}
      {gapSuggestion && (
        <div className="glass border border-emerald-500/30 bg-emerald-500/10 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <Zap className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-emerald-400 mb-0.5">Gap Fill Available</div>
            <div className="text-xs text-slate-300">
              <span className="font-medium text-white">{gapSuggestion.walkIn?.name}</span> (Walk-In, {gapSuggestion.walkIn?.predictedDuration} min) can be served before the{' '}
              <span className="font-medium text-white">{gapSuggestion.nextAppointmentDisplay}</span> appointment.{' '}
              There is a <span className="text-emerald-400 font-medium">{gapSuggestion.gapMinutes} min gap</span> available.
            </div>
          </div>
          <button onClick={() => callNext.mutate()} className="btn-success text-xs px-3 py-1.5 shrink-0">
            Serve Now
          </button>
        </div>
      )}

      {/* Late Patients Warning */}
      {latePatients.length > 0 && (
        <div className="glass border border-orange-500/30 bg-orange-500/10 rounded-xl p-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-semibold text-orange-400">Late Patients ({latePatients.length})</span>
          </div>
          <div className="space-y-2">
            {latePatients.map(p => (
              <div key={p._id} className="flex items-center gap-3 text-sm">
                <div className="flex-1">
                  <span className="text-slate-200 font-medium">{p.name}</span>
                  <span className="text-slate-500 ml-2 text-xs">({fmt12(p.appointmentTime)} · {p.visitType})</span>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => checkin.mutate(p._id)} className="btn-success text-xs py-1 px-2">
                    <UserPlus className="w-3 h-3" /> Check-In
                  </button>
                  <button onClick={() => noShow.mutate(p._id)} className="btn-danger text-xs py-1 px-2">
                    No Show
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Queue Table */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/5">
              <tr>
                {['Appt Time', 'Patient', 'Visit Type', 'Source', 'Duration', 'Status', 'Est. Consult', 'Actions'].map(h => (
                  <th key={h} className="table-head">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allPatients.length === 0 && (
                <tr><td colSpan="8" className="text-center py-8 text-slate-500">No patients in queue today</td></tr>
              )}
              {allPatients.map((p) => (
                <PatientRow key={p._id} patient={p} complete={complete} noShow={noShow} late={late} skip={skip} remove={remove} checkin={checkin} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Completed Today */}
      {queue?.completedPatients?.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Completed Today ({queue.completedPatients.length})
          </h3>
          <div className="space-y-2">
            {queue.completedPatients.slice(-5).reverse().map(p => (
              <div key={p._id} className="flex items-center gap-3 text-sm text-slate-500">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-mono text-slate-600 w-16">{fmt12(p.appointmentTime)}</span>
                <span className="text-slate-300">{p.name}</span>
                <span className="text-slate-600">{p.visitType}</span>
                {p.actualDuration && <span className="ml-auto text-xs">{p.actualDuration}min actual</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Walk-In Modal */}
      {showWalkInModal && (
        <AddWalkInModal onClose={() => setShowWalkInModal(false)} qc={qc} />
      )}
    </div>
  )
}

function PatientRow({ patient: p, complete, noShow, late, skip, remove, checkin }) {
  const [expanded, setExpanded] = useState(false)

  const statusConfig = {
    'in-consultation': { label: 'In Consult', cls: 'bg-emerald-500/20 text-emerald-400' },
    waiting:           { label: 'Waiting',    cls: 'bg-amber-500/20 text-amber-400' },
    scheduled:         { label: 'Scheduled',  cls: 'bg-blue-500/20 text-blue-400' },
    'checked-in':      { label: 'Checked In', cls: 'bg-cyan-500/20 text-cyan-400' },
    late:              { label: 'Late',        cls: 'bg-orange-500/20 text-orange-400' },
    completed:         { label: 'Completed',   cls: 'bg-slate-500/20 text-slate-400' },
    'no-show':         { label: 'No Show',     cls: 'bg-red-500/20 text-red-400' },
  }
  const st = statusConfig[p.status] || { label: p.status, cls: 'text-slate-500' }

  return (
    <>
      <tr className={`table-row cursor-pointer select-none ${expanded ? 'bg-brand-500/5' : ''}`} onClick={() => setExpanded(v => !v)}>
        <td className="table-cell font-mono text-brand-400 text-xs">{fmt12(p.appointmentTime)}</td>
        <td className="table-cell">
          <div className="font-medium text-slate-200 flex items-center gap-1.5">
            {p.name}
            {expanded
              ? <ChevronUp className="w-3 h-3 text-slate-500" />
              : <ChevronDown className="w-3 h-3 text-slate-500" />}
          </div>
          <div className="text-xs text-slate-600 font-mono">{p.appointmentId || '—'}</div>
        </td>
        <td className="table-cell text-xs">{p.visitType}</td>
        <td className="table-cell">
          <span className={`text-xs px-2 py-0.5 rounded-full ${p.source === 'walkin' ? 'bg-amber-500/20 text-amber-400' : 'bg-brand-500/20 text-brand-400'}`}>
            {p.source === 'walkin' ? '🚶 Walk-In' : '📅 Appt'}
          </span>
        </td>
        <td className="table-cell text-brand-400 font-medium">{p.predictedDuration}m</td>
        <td className="table-cell">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>
            {st.label}
          </span>
        </td>
        <td className="table-cell text-xs text-slate-400">
          {p.expectedConsultationTime
            ? new Date(p.expectedConsultationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '—'}
        </td>
        <td className="table-cell" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1.5 flex-wrap">
            {p.status === 'scheduled' && (
              <>
                <button onClick={() => checkin.mutate(p._id)} className="btn-success text-xs py-1 px-2">
                  <UserPlus className="w-3 h-3" /> Check-In
                </button>
                <button onClick={() => late.mutate(p._id)} className="btn-amber text-xs py-1 px-2" title="Mark Late">
                  <ClockAlert className="w-3 h-3" />
                </button>
              </>
            )}
            {p.status === 'in-consultation' && (
              <button onClick={() => complete.mutate(p._id)} className="btn-success text-xs py-1 px-2">
                <CheckCircle2 className="w-3 h-3" /> Done
              </button>
            )}
            {['waiting', 'checked-in'].includes(p.status) && (
              <button onClick={() => skip.mutate(p._id)} className="btn-amber text-xs py-1 px-2" title="Move to end">
                <SkipForward className="w-3 h-3" />
              </button>
            )}
            {['waiting', 'checked-in', 'scheduled', 'late'].includes(p.status) && (
              <button onClick={() => noShow.mutate(p._id)} className="btn-danger text-xs py-1 px-2" title="No Show">
                <AlertTriangle className="w-3 h-3" />
              </button>
            )}
            {!['in-consultation', 'completed', 'no-show', 'cancelled'].includes(p.status) && (
              <button onClick={() => remove.mutate(p._id)} className="text-slate-600 hover:text-red-400 transition-colors" title="Remove">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expandable Patient Profile Panel */}
      {expanded && (
        <tr className="animate-fade-in">
          <td colSpan="8" className="px-4 pb-4 pt-0">
            <div className="bg-slate-900/60 border border-white/8 rounded-xl p-4 mt-1">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Patient Profile
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <ProfileField label="Full Name"   value={p.name} />
                <ProfileField label="Phone"        value={p.phone} highlight />
                <ProfileField label="Age"          value={p.age ? `${p.age} yrs` : '—'} />
                <ProfileField label="Gender"       value={p.gender || '—'} />
                <ProfileField label="Visit Type"   value={p.visitType} />
                <ProfileField label="Source"       value={p.source === 'walkin' ? '🚶 Walk-In' : '📅 Appointment'} />
                <ProfileField label="Appt Date"    value={p.appointmentDate || '—'} />
                <ProfileField label="Appt Time"    value={fmt12(p.appointmentTime)} />
              </div>
              {p.notes && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <div className="text-xs text-slate-500 mb-1">Notes</div>
                  <div className="text-sm text-slate-300">📝 {p.notes}</div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function ProfileField({ label, value, highlight }) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-0.5">{label}</div>
      <div className={`text-sm font-medium ${highlight ? 'text-brand-400' : 'text-slate-200'}`}>{value || '—'}</div>
    </div>
  )
}

// ── Add Walk-In Modal ─────────────────────────────────────────────────────────
function AddWalkInModal({ onClose, qc }) {
  const [form, setForm] = useState({ name: '', age: '', phone: '', visitType: '' })
  const [slotPreview, setSlotPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  // Fetch slot preview when visitType or age changes
  useEffect(() => {
    if (!form.visitType || !form.age) { setSlotPreview(null); return }
    setPreviewLoading(true)
    getNextWalkInSlot({ visitType: form.visitType, age: form.age })
      .then(data => { setSlotPreview(data); setPreviewLoading(false) })
      .catch(() => setPreviewLoading(false))
  }, [form.visitType, form.age])

  const addMut = useMutation({
    mutationFn: addWalkInReceptionist,
    onSuccess: (data) => {
      toast.success(`Walk-in added — slot: ${data.slot?.displayTime}`)
      qc.invalidateQueries({ queryKey: ['queue'] })
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to add walk-in'),
  })

  const handleSubmit = () => {
    if (!form.name || !form.age || !form.phone || !form.visitType) {
      toast.error('Please fill all fields')
      return
    }
    addMut.mutate({ ...form, age: parseInt(form.age) })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="glass w-full max-w-md rounded-2xl p-6 border border-white/10 shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">Add Walk-In Patient</h2>
            <p className="text-xs text-slate-400 mt-0.5">System will assign the next available slot</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Full Name *</label>
            <input className="input" placeholder="Patient name" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Age *</label>
              <input className="input" type="number" min="0" max="120" placeholder="Age" value={form.age} onChange={e => set('age', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Phone *</label>
              <input className="input" type="tel" placeholder="Phone number" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Visit Type *</label>
            <select className="select" value={form.visitType} onChange={e => set('visitType', e.target.value)}>
              <option value="">Select visit type...</option>
              {VISIT_TYPES.map(v => <option key={v}>{v}</option>)}
            </select>
          </div>

          {/* Slot Preview */}
          {(slotPreview || previewLoading) && (
            <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-4">
              <div className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5" /> AI Slot Assignment Preview
              </div>
              {previewLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Computing slot...
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-lg font-bold text-white">{slotPreview?.displayTime}</div>
                    <div className="text-xs text-slate-500">Assigned Slot</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-amber-400">~{slotPreview?.estimatedWaitMinutes} min</div>
                    <div className="text-xs text-slate-500">Est. Wait</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-brand-400">{slotPreview?.predictedDuration} min</div>
                    <div className="text-xs text-slate-500">Consultation</div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button onClick={handleSubmit} disabled={addMut.isPending} className="btn-primary flex-1 text-sm">
              {addMut.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Adding...</> : <><UserPlus className="w-3.5 h-3.5" /> Confirm</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Schedule Tab ──────────────────────────────────────────────────────────────
function ScheduleTab({ clinic, qc }) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [selectedDate, setSelectedDate] = useState(today)

  const { data: schedData, refetch } = useQuery({
    queryKey: ['schedule', selectedDate],
    queryFn: () => getSchedule(selectedDate),
  })

  const sched = schedData?.schedule
  const [wh, setWh] = useState([])
  const [breaks, setBreaks] = useState([])
  const [status, setStatus] = useState('available')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (sched) {
      setWh(sched.workingHours || [{ start: '10:00', end: '13:00' }, { start: '14:00', end: '17:00' }])
      setBreaks(sched.breaks || [{ name: 'Lunch Break', start: '13:00', end: '14:00' }])
      setStatus(sched.status || 'available')
      setReason(sched.reason || '')
    }
  }, [sched])

  const saveMut = useMutation({
    mutationFn: () => updateSchedule(selectedDate, { workingHours: wh, breaks, status, reason }),
    onSuccess: () => { toast.success('Schedule saved!'); refetch() },
    onError: () => toast.error('Failed to save'),
  })

  const nextDays = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(new Date(), i)
    return { value: format(d, 'yyyy-MM-dd'), label: format(d, 'EEE d') }
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Select Date</h3>
        <div className="flex gap-2 flex-wrap">
          {nextDays.map(d => (
            <button key={d.value} onClick={() => setSelectedDate(d.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                ${selectedDate === d.value ? 'bg-brand-500/20 border-brand-500/50 text-brand-400' : 'border-white/10 text-slate-400 hover:border-white/20'}`}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Availability for {selectedDate}</h3>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {['available', 'holiday', 'conference', 'half-day', 'unavailable'].map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border capitalize transition-all
                  ${status === s ? 'bg-brand-500/20 border-brand-500/50 text-brand-400' : 'border-white/10 text-slate-400 hover:border-white/20'}`}>
                {s}
              </button>
            ))}
          </div>
          {status !== 'available' && (
            <input className="input text-sm" placeholder="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)} />
          )}
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Working Hours</h3>
          <div className="space-y-2">
            {wh.map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="time" className="input text-sm" value={w.start} onChange={e => setWh(prev => prev.map((x, j) => j === i ? { ...x, start: e.target.value } : x))} />
                <span className="text-slate-500 text-xs">to</span>
                <input type="time" className="input text-sm" value={w.end} onChange={e => setWh(prev => prev.map((x, j) => j === i ? { ...x, end: e.target.value } : x))} />
                <button onClick={() => setWh(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={() => setWh(prev => [...prev, { start: '09:00', end: '12:00' }])} className="text-brand-400 text-xs hover:text-brand-300">+ Add session</button>
          </div>
        </div>

        <div className="card md:col-span-2">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Breaks</h3>
          <div className="space-y-2">
            {breaks.map((b, i) => (
              <div key={i} className="flex items-center gap-2 flex-wrap">
                <input className="input text-sm w-32" placeholder="Break name" value={b.name} onChange={e => setBreaks(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                <input type="time" className="input text-sm w-32" value={b.start} onChange={e => setBreaks(prev => prev.map((x, j) => j === i ? { ...x, start: e.target.value } : x))} />
                <span className="text-slate-500 text-xs">to</span>
                <input type="time" className="input text-sm w-32" value={b.end} onChange={e => setBreaks(prev => prev.map((x, j) => j === i ? { ...x, end: e.target.value } : x))} />
                <button onClick={() => setBreaks(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={() => setBreaks(prev => [...prev, { name: 'Break', start: '12:00', end: '12:30' }])} className="text-brand-400 text-xs hover:text-brand-300">+ Add break</button>
          </div>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="btn-primary mt-4 text-sm">
            {saveMut.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Analytics Tab ─────────────────────────────────────────────────────────────
function AnalyticsTab({ analytics }) {
  const heatmap = analytics?.heatmap || {}
  const chartData = Object.entries(heatmap).map(([hour, data]) => ({
    hour: `${hour}:00`,
    patients: data.count,
    load: data.consultationLoad,
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox label="Patients Today" value={analytics?.total || 0} />
        <StatBox label="Completed"      value={analytics?.completed || 0} color="text-emerald-400" />
        <StatBox label="Avg Duration"   value={`${analytics?.avgWait || 0}m`} color="text-brand-400" />
        <StatBox label="Utilization"    value={`${analytics?.utilization || 0}%`} color="text-indigo-400" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="stat-card"><div className="stat-label">Longest Wait</div><div className="stat-value text-amber-400">{analytics?.longestWait || 0} min</div></div>
        <div className="stat-card"><div className="stat-label">Shortest Wait</div><div className="stat-value text-emerald-400">{analytics?.shortestWait || 0} min</div></div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-brand-400" />
          Patient Load by Hour (Today)
        </h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f1f5f9' }}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              />
              <Bar dataKey="patients" name="Patients" fill="#14b8a6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-slate-500">No data yet today</div>
        )}
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Doctor Utilization</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-3 rounded-full bg-dark-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${Math.min(100, analytics?.utilization || 0)}%` }}
            />
          </div>
          <span className="text-brand-400 font-bold text-lg shrink-0">{analytics?.utilization || 0}%</span>
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-2">
          <span>Total: {analytics?.totalActualMinutes || 0} min</span>
          <span>Available: {analytics?.workingMinutes || 0} min</span>
        </div>
      </div>
    </div>
  )
}


// ── Shared ────────────────────────────────────────────────────────────────────
function StatBox({ label, value, color = 'text-white' }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${color}`}>{value}</div>
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

// ── Learning Tab ───────────────────────────────────────────────────────────────
function LearningTab({ learning, refetchLearning }) {
  const [retraining, setRetraining] = useState(false)
  const [lastResult, setLastResult] = useState(null)

  const mi         = learning?.modelInfo || {}
  const realSamples  = mi.real_samples      ?? 0
  const synthSamples = mi.synthetic_samples ?? 601
  const totalSamples = mi.total_samples     ?? synthSamples
  const r2           = mi.r2_score          != null ? (mi.r2_score * 100).toFixed(1) : '—'
  const mae          = mi.mae_minutes       != null ? mi.mae_minutes.toFixed(1) : '—'
  const dataSource   = mi.data_source       || 'synthetic_only'
  const lastTrained  = mi.last_trained      ? new Date(mi.last_trained).toLocaleString() : 'Never'
  const totalReal    = learning?.totalRealRecords ?? 0
  const threshold    = learning?.retrainThreshold ?? 50
  const ready        = learning?.readyToRetrain   ?? false
  const byVisitType  = learning?.byVisitType      || []
  const recentRecs   = learning?.recentRecords    || []

  const dataSourceConfig = {
    synthetic_only: { label: 'Synthetic Only',   cls: 'bg-slate-500/20 text-slate-400',   icon: Database },
    early_blend:    { label: 'Early Blend',       cls: 'bg-amber-500/20  text-amber-400',   icon: FlaskConical },
    blended:        { label: 'Blending',          cls: 'bg-brand-500/20  text-brand-400',   icon: TrendingUp },
    real_dominant:  { label: 'Real-Data Model',   cls: 'bg-emerald-500/20 text-emerald-400', icon: Sparkles },
  }
  const dsc = dataSourceConfig[dataSource] || dataSourceConfig.synthetic_only
  const DscIcon = dsc.icon

  // Phase determination
  const phase = realSamples === 0 ? 1 : realSamples < 50 ? 2 : realSamples < 500 ? 3 : 4

  const PHASES = [
    { n: 1, label: 'Synthetic Bootstrap', desc: 'CSV-trained model running' },
    { n: 2, label: 'Collecting Data',     desc: 'Real consultations being captured' },
    { n: 3, label: 'Retraining',          desc: 'Blending real + synthetic data' },
    { n: 4, label: 'Personalized',        desc: 'Clinic-specific predictions' },
  ]

  const handleRetrain = async () => {
    if (!ready) {
      toast.error(`Need at least 10 real consultations to retrain (have ${totalReal})`)
      return
    }
    setRetraining(true)
    try {
      const result = await triggerRetrain()
      setLastResult(result)
      toast.success(`Model retrained on ${result.total_samples} samples!`)
      refetchLearning()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Retraining failed')
    } finally {
      setRetraining(false)
    }
  }

  const progressPct = Math.min(100, Math.round((totalReal / threshold) * 100))

  const errColor = (err) => {
    if (err == null) return 'text-slate-500'
    const abs = Math.abs(err)
    if (abs <= 2)  return 'text-emerald-400'
    if (abs <= 5)  return 'text-amber-400'
    return 'text-red-400'
  }
  const errIcon = (err) => {
    if (err == null) return <Minus className="w-3 h-3" />
    if (err > 2)   return <ArrowUpRight className="w-3 h-3 text-red-400" />
    if (err < -2)  return <ArrowDownRight className="w-3 h-3 text-emerald-400" />
    return <Minus className="w-3 h-3 text-emerald-400" />
  }

  if (!learning) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-3">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading learning stats...
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Row 1: Model Status + Retrain ──────────────────────────────────── */}
      <div className="grid md:grid-cols-3 gap-4">

        {/* Model Status */}
        <div className="glass rounded-2xl p-5 border border-white/8 md:col-span-2">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center">
                <Brain className="w-5 h-5 text-brand-400" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Prediction Model</div>
                <div className="text-xs text-slate-500">Random Forest · 200 estimators</div>
              </div>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${dsc.cls}`}>
              <DscIcon className="w-3 h-3" /> {dsc.label}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-black text-brand-400">{r2}%</div>
              <div className="text-xs text-slate-500 mt-0.5">R² Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-amber-400">±{mae}m</div>
              <div className="text-xs text-slate-500 mt-0.5">Mean Abs Error</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-emerald-400">{realSamples}</div>
              <div className="text-xs text-slate-500 mt-0.5">Real Records</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-slate-300">{synthSamples}</div>
              <div className="text-xs text-slate-500 mt-0.5">Synthetic Records</div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5" /> Last trained: {lastTrained}
          </div>
        </div>

        {/* Retrain Card */}
        <div className="glass rounded-2xl p-5 border border-white/8 flex flex-col justify-between">
          <div>
            <div className="text-sm font-bold text-white mb-1">Retrain Model</div>
            <div className="text-xs text-slate-400 mb-4">
              Blend {totalReal} real consultation{totalReal !== 1 ? 's' : ''} with {synthSamples} synthetic records.
            </div>

            {/* Progress to threshold */}
            <div className="mb-2">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400">Real data progress</span>
                <span className={totalReal >= threshold ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                  {totalReal} / {threshold}
                </span>
              </div>
              <div className="h-2 rounded-full bg-dark-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="text-xs text-slate-600 mt-1">{progressPct}% toward recommended threshold</div>
            </div>
          </div>

          <div className="space-y-2 mt-3">
            {lastResult && (
              <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                ✅ R²: {(lastResult.r2_score * 100).toFixed(1)}% · MAE: {lastResult.mae_minutes?.toFixed(1)}m
              </div>
            )}
            <button
              onClick={handleRetrain}
              disabled={retraining || !ready}
              className={`w-full btn-primary text-sm justify-center ${!ready ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {retraining
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Retraining…</>
                : <><Brain className="w-4 h-4" /> Retrain Now</>}
            </button>
            {!ready && (
              <p className="text-xs text-slate-600 text-center">
                Need {Math.max(0, 10 - totalReal)} more consultation{10 - totalReal !== 1 ? 's' : ''} to enable
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: AI Evolution Phase Stepper ─────────────────────────────── */}
      <div className="glass rounded-2xl p-5 border border-white/8">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" /> AI Evolution Path
        </div>
        <div className="flex items-start gap-0">
          {PHASES.map((p, idx) => {
            const isDone    = phase > p.n
            const isCurrent = phase === p.n
            return (
              <div key={p.n} className="flex-1 flex flex-col items-center">
                <div className="flex items-center w-full">
                  {idx > 0 && (
                    <div className={`h-0.5 flex-1 transition-all ${isDone ? 'bg-brand-500' : 'bg-white/10'}`} />
                  )}
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                    ${isDone    ? 'bg-brand-500 border-brand-500 text-white'        : ''}
                    ${isCurrent ? 'bg-brand-500/20 border-brand-400 text-brand-400 ring-2 ring-brand-400/30' : ''}
                    ${!isDone && !isCurrent ? 'bg-dark-800 border-white/10 text-slate-600' : ''}`
                  }>
                    {isDone
                      ? <CheckCircle2 className="w-4 h-4" />
                      : <span className="text-xs font-bold">{p.n}</span>}
                  </div>
                  {idx < PHASES.length - 1 && (
                    <div className={`h-0.5 flex-1 transition-all ${isDone ? 'bg-brand-500' : 'bg-white/10'}`} />
                  )}
                </div>
                <div className={`mt-2 text-center px-1 ${isCurrent ? 'opacity-100' : 'opacity-50'}`}>
                  <div className={`text-xs font-semibold ${isCurrent ? 'text-brand-400' : 'text-slate-400'}`}>
                    {p.label}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5 hidden sm:block">{p.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Row 3: Per-Visit-Type Accuracy ────────────────────────────────── */}
      <div className="glass rounded-2xl border border-white/8 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-semibold text-white">Per-Visit-Type Accuracy</span>
          <span className="text-xs text-slate-500 ml-auto">{totalReal} real consultations collected</span>
        </div>
        {byVisitType.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-500 text-sm">
            <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No consultation history yet. Complete consultations to start collecting data.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/5">
                <tr>
                  {['Visit Type', 'Consultations', 'Avg Actual', 'Avg Predicted', 'MAE', 'Accuracy'].map(h => (
                    <th key={h} className="table-head">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byVisitType.map(row => {
                  const accPct = row.avgActual > 0
                    ? Math.max(0, Math.round((1 - row.mae / row.avgActual) * 100))
                    : null
                  const accColor = accPct == null ? 'text-slate-500'
                    : accPct >= 85 ? 'text-emerald-400'
                    : accPct >= 70 ? 'text-amber-400'
                    : 'text-red-400'
                  return (
                    <tr key={row.visitType} className="table-row">
                      <td className="table-cell font-medium text-slate-200">{row.visitType}</td>
                      <td className="table-cell text-brand-400 font-mono">{row.count}</td>
                      <td className="table-cell text-slate-300 font-mono">{row.avgActual}m</td>
                      <td className="table-cell text-slate-400 font-mono">{row.avgPredicted}m</td>
                      <td className={`table-cell font-mono font-semibold ${Math.abs(row.avgError) <= 2 ? 'text-emerald-400' : Math.abs(row.avgError) <= 5 ? 'text-amber-400' : 'text-red-400'}`}>
                        ±{row.mae}m
                      </td>
                      <td className={`table-cell font-bold ${accColor}`}>
                        {accPct != null ? `${accPct}%` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Row 4: Recent Consultations ────────────────────────────────────── */}
      {recentRecs.length > 0 && (
        <div className="glass rounded-2xl border border-white/8 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-white">Recent Consultations</span>
            <span className="text-xs text-slate-500 ml-auto">Last {recentRecs.length} records</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/5">
                <tr>
                  {['Date', 'Visit Type', 'Age', 'Source', 'Actual', 'Predicted', 'Error'].map(h => (
                    <th key={h} className="table-head">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentRecs.map(r => {
                  const err = r.predictionError
                  return (
                    <tr key={r._id} className="table-row">
                      <td className="table-cell font-mono text-xs text-slate-500">{r.date || '—'}</td>
                      <td className="table-cell text-slate-200">{r.visitType}</td>
                      <td className="table-cell text-slate-400 font-mono">{r.age ?? '—'}</td>
                      <td className="table-cell">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${r.appointmentSource === 'walkin' ? 'bg-amber-500/20 text-amber-400' : 'bg-brand-500/20 text-brand-400'}`}>
                          {r.appointmentSource === 'walkin' ? '🚶 Walk-In' : '📅 Appt'}
                        </span>
                      </td>
                      <td className="table-cell font-mono text-white font-semibold">{r.actualDuration}m</td>
                      <td className="table-cell font-mono text-slate-400">{r.predictedDuration}m</td>
                      <td className={`table-cell font-mono font-semibold flex items-center gap-1 ${errColor(err)}`}>
                        {errIcon(err)}
                        {err != null ? (err > 0 ? `+${err}` : err) : '—'}m
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

