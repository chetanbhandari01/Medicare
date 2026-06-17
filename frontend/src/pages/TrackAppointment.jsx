import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, Phone, Hash, Loader2, AlertCircle,
  Users, Stethoscope, Timer, Activity, CalendarClock,
  CheckCircle2, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Navbar from '../components/Navbar'
import AppointmentCard from '../components/AppointmentCard'
import { searchAppointments, cancelAppointment, getAppointmentAhead } from '../services/api'
import { useSocket } from '../hooks/useSocket'

export default function TrackAppointment() {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState('phone')
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['track', mode, query],
    queryFn: () => searchAppointments(mode === 'phone' ? { phone: query } : { appointmentId: query.toUpperCase() }),
    enabled: false,
  })

  const cancelMutation = useMutation({
    mutationFn: cancelAppointment,
    onSuccess: () => {
      toast.success('Appointment cancelled.')
      refetch()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Cancel failed'),
  })

  useSocket('queueUpdated',          () => { if (searched) refetch() })
  useSocket('consultationCompleted', () => { if (searched) refetch() })

  const handleSearch = () => {
    if (!query.trim()) {
      toast.error('Please enter a phone number or appointment ID')
      return
    }
    setSearched(true)
    refetch()
  }

  const patients = data?.patients || []

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
        <div className="page-header text-center">
          <h1 className="page-title">Track Appointment</h1>
          <p className="page-subtitle">Find your appointment status and live queue position</p>
        </div>

        {/* Search Card */}
        <div className="card mb-6 animate-fade-in">
          <div className="flex gap-2 mb-5">
            {[
              { id: 'phone', icon: Phone, label: 'Phone Number' },
              { id: 'id',    icon: Hash,  label: 'Appointment ID' },
            ].map(({ id, icon: Icon, label }) => (
              <button key={id} onClick={() => { setMode(id); setQuery(''); setSearched(false) }}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-2
                  ${mode === id ? 'bg-brand-500/20 border-brand-500/50 text-brand-400' : 'border-white/10 text-slate-400 hover:border-white/20'}`}>
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder={mode === 'phone' ? 'Enter phone number...' : 'e.g. MED-2026-AB12'}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} className="btn-primary px-4">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm mb-4">
            <AlertCircle className="w-4 h-4" /> Failed to search. Please try again.
          </div>
        )}

        {searched && !isLoading && patients.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <div className="font-medium">No appointments found</div>
            <div className="text-sm mt-1">Try a different phone number or ID</div>
          </div>
        )}

        {patients.length > 0 && (
          <div className="space-y-8 animate-slide-up">
            <p className="text-xs text-slate-500">{patients.length} appointment{patients.length > 1 ? 's' : ''} found</p>
            {patients.map(p => (
              <AppointmentWithAhead
                key={p._id}
                patient={p}
                onCancel={id => cancelMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Full Queue Timeline ────────────────────────────────────────────────────────
function AppointmentWithAhead({ patient, onCancel }) {
  const isActive = ['scheduled', 'checked-in', 'waiting', 'in-consultation', 'late'].includes(patient.status)

  const { data: aheadData, isLoading: aLoading } = useQuery({
    queryKey: ['ahead', patient._id],
    queryFn: () => getAppointmentAhead(patient.appointmentId || patient._id),
    enabled: isActive,
    refetchInterval: 12000,
  })

  const ahead  = aheadData?.ahead || []       // physically waiting before this patient
  const timeline = aheadData?.timeline || []  // all booked slots up to this patient
  const currentlyIn = aheadData?.currentlyIn  // patient currently in consultation

  // Build the visual rows: currentlyIn at top, then timeline (ahead + this patient), "you" always marked
  const rows = []

  // 1. In consultation row (if any and not this patient)
  if (currentlyIn && currentlyIn._id?.toString() !== patient._id?.toString()) {
    rows.push({ ...currentlyIn, _type: 'in-consultation' })
  }

  // 2. All timeline entries (excludes in-consultation, already shown above)
  //    timeline comes back sorted by appointmentTime asc, includes the patient themselves
  timeline.forEach(p => {
    if (p.status === 'in-consultation') return // already shown
    rows.push({ ...p, _type: p._id?.toString() === patient._id?.toString() ? 'you' : 'other' })
  })

  return (
    <div className="space-y-4">
      {/* Appointment card */}
      <AppointmentCard
        patient={patient}
        patientsAhead={ahead.length + (currentlyIn ? 1 : 0)}
        showActions
        onCancel={onCancel}
      />

      {/* Queue timeline — always visible for active appointments */}
      {isActive && (
        <div className="glass rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-400" />
              <span className="text-sm font-semibold text-slate-200">Queue Before Your Appointment</span>
            </div>
            <div className="flex items-center gap-2">
              {aLoading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                : <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold">
                    {ahead.length + (currentlyIn ? 1 : 0)} ahead
                  </span>
              }
              <span className="text-xs text-slate-600">auto-updates</span>
            </div>
          </div>

          {/* Timeline body */}
          <div className="p-4">
            {aLoading && rows.length === 0 ? (
              <div className="flex items-center justify-center py-6 gap-2 text-slate-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading queue…
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                <Activity className="w-6 h-6 mx-auto mb-1 opacity-30" />
                You're first — no one ahead of you!
              </div>
            ) : (
              <div className="relative">
                {/* Vertical connector line */}
                <div className="absolute left-[19px] top-5 bottom-5 w-px bg-white/8" />

                <div className="space-y-1">
                  {rows.map((row, idx) => (
                    <TimelineRow key={row._id || idx} row={row} isLast={idx === rows.length - 1} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Single timeline row ────────────────────────────────────────────────────────
function TimelineRow({ row, isLast }) {
  const isYou = row._type === 'you'
  const isInConsult = row._type === 'in-consultation' || row.status === 'in-consultation'

  const dotColor = isYou
    ? 'bg-brand-500 ring-2 ring-brand-500/40'
    : isInConsult
      ? 'bg-emerald-500 ring-2 ring-emerald-500/40'
      : {
          waiting:      'bg-amber-400',
          'checked-in': 'bg-cyan-400',
          late:         'bg-orange-400',
          scheduled:    'bg-slate-500',
        }[row.status] || 'bg-slate-600'

  const statusLabel = isInConsult ? 'In Consultation' : {
    waiting:      'Waiting',
    'checked-in': 'Checked In',
    late:         'Late',
    scheduled:    'Scheduled',
  }[row.status] || row.status

  const statusColor = isInConsult
    ? 'text-emerald-400'
    : {
        waiting:      'text-amber-400',
        'checked-in': 'text-cyan-400',
        late:         'text-orange-400',
        scheduled:    'text-slate-500',
      }[row.status] || 'text-slate-500'

  return (
    <div className={`relative flex items-center gap-3 pl-2 py-1.5 rounded-xl transition-all
      ${isYou ? 'bg-brand-500/10 border border-brand-500/25 px-3' : ''}`}>

      {/* Dot */}
      <div className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center z-10 ${dotColor}`}>
        {isInConsult && <Stethoscope className="w-3 h-3 text-white" />}
        {isYou && <span className="text-[9px] font-black text-white leading-none">YOU</span>}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isYou ? 'text-brand-300' : 'text-slate-200'}`}>
            {row.visitType}
          </span>
          {row.source === 'walkin' && (
            <span className="text-xs text-amber-500 opacity-70">Walk-In</span>
          )}
        </div>
        <div className={`text-xs ${statusColor}`}>{statusLabel}</div>
      </div>

      {/* Time + duration */}
      <div className="text-right shrink-0">
        <div className={`text-xs font-mono ${isYou ? 'text-brand-400 font-semibold' : 'text-slate-400'}`}>
          {fmt12(row.appointmentTime)}
        </div>
        <div className="text-xs text-slate-600 flex items-center gap-0.5 justify-end">
          <Timer className="w-3 h-3" />
          {row.predictedDuration}m
        </div>
      </div>
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
