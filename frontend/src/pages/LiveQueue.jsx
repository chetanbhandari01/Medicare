import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Users, Activity, User, Timer, Stethoscope, RefreshCw, CalendarClock, TrendingUp } from 'lucide-react'
import Navbar from '../components/Navbar'
import DoctorStatusBadge from '../components/DoctorStatusBadge'
import { getQueue, getClinic, getAppointment } from '../services/api'
import { useSocket } from '../hooks/useSocket'

export default function LiveQueue() {
  const { appointmentId } = useParams()
  const queryClient = useQueryClient()

  const { data: queue, isLoading: qLoading } = useQuery({
    queryKey: ['queue'],
    queryFn: getQueue,
    refetchInterval: 10000,
  })
  const { data: clinic } = useQuery({ queryKey: ['clinic'], queryFn: getClinic, refetchInterval: 30000 })
  const { data: apptData } = useQuery({
    queryKey: ['appt', appointmentId],
    queryFn: () => getAppointment(appointmentId),
    enabled: !!appointmentId,
    refetchInterval: 15000,
  })

  // Real-time socket updates
  useSocket('queueUpdated',          () => { queryClient.invalidateQueries({ queryKey: ['queue'] }); queryClient.invalidateQueries({ queryKey: ['appt'] }) })
  useSocket('callNextPatient',       () => { queryClient.invalidateQueries({ queryKey: ['queue'] }); queryClient.invalidateQueries({ queryKey: ['appt'] }) })
  useSocket('consultationCompleted', () => { queryClient.invalidateQueries({ queryKey: ['queue'] }); queryClient.invalidateQueries({ queryKey: ['appt'] }) })
  useSocket('doctorStatusChanged',   () => queryClient.invalidateQueries({ queryKey: ['clinic'] }))

  const myPatient = apptData?.patient
  const myPosition = apptData?.patientsAhead
  const myWaitMinutes = apptData?.waitMinutes
  const myExpectedTime = apptData?.expectedConsultationTime

  // Compute how far behind schedule the queue is running
  const now = new Date()
  let delayMinutes = 0
  if (myPatient?.appointmentTime && myExpectedTime) {
    const [h, m] = myPatient.appointmentTime.split(':').map(Number)
    const apptMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime()
    const expectedMs = new Date(myExpectedTime).getTime()
    delayMinutes = Math.max(0, Math.round((expectedMs - apptMs) / 60000))
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <div className="page-header flex items-start justify-between">
          <div>
            <h1 className="page-title">Live Queue</h1>
            <p className="page-subtitle">Real-time queue status · updates automatically</p>
          </div>
          <DoctorStatusBadge status={clinic?.currentStatus || 'available'} />
        </div>

        {/* My Appointment Card */}
        {myPatient && (
          <div className="glass p-5 rounded-2xl mb-6 border border-brand-500/20 animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <div className="pulse-dot green" />
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">Your Appointment</span>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                myPatient.status === 'in-consultation' ? 'bg-emerald-500/20 text-emerald-400' :
                myPatient.status === 'waiting'         ? 'bg-amber-500/20 text-amber-400' :
                myPatient.status === 'checked-in'      ? 'bg-cyan-500/20 text-cyan-400' :
                myPatient.status === 'scheduled'       ? 'bg-blue-500/20 text-blue-400' :
                                                         'bg-slate-500/20 text-slate-400'
              }`}>
                {myPatient.status?.replace('-', ' ')}
              </span>
            </div>

            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center">
                <User className="w-6 h-6 text-brand-400" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white">{myPatient.name}</div>
                <div className="text-xs text-slate-400">{myPatient.visitType} · {myPatient.appointmentId}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <div className="text-xs text-slate-500 mb-1 flex items-center justify-center gap-1">
                  <CalendarClock className="w-3 h-3" /> Appt Time
                </div>
                <div className="text-sm font-bold text-white">{fmt12(myPatient.appointmentTime)}</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <div className="text-xs text-slate-500 mb-1 flex items-center justify-center gap-1">
                  <Users className="w-3 h-3" /> Ahead
                </div>
                <div className="text-2xl font-bold text-amber-400">{typeof myPosition === 'number' ? myPosition : '—'}</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <div className="text-xs text-slate-500 mb-1 flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3" /> Est. Start
                </div>
                <div className="text-sm font-bold text-brand-400">
                  {myExpectedTime ? new Date(myExpectedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <div className="text-xs text-slate-500 mb-1 flex items-center justify-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Delay
                </div>
                <div className={`text-sm font-bold ${delayMinutes > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                  {delayMinutes > 0 ? `+${delayMinutes} min` : 'On time'}
                </div>
              </div>
            </div>

            {myPatient.status === 'in-consultation' && (
              <div className="mt-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                <span className="pulse-dot green inline-block mr-2" />
                <span className="text-sm text-emerald-400 font-semibold">You are currently being seen by the doctor</span>
              </div>
            )}
          </div>
        )}

        {/* Live Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard icon={Activity} label="In Consultation" value={queue?.currentPatient?.name || 'None'} sub={queue?.currentPatient?.visitType} color="text-emerald-400" />
          <StatCard icon={Users} label="Waiting" value={queue?.queueLength || 0} color="text-amber-400" />
          <StatCard icon={Clock} label="Est. Wait" value={`${queue?.totalWaitMinutes || 0}m`} color="text-brand-400" />
        </div>

        {/* Current Patient */}
        {queue?.currentPatient && (
          <div className="glass p-4 rounded-xl mb-6 border border-emerald-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Currently Being Served</div>
                <div className="font-semibold text-white">{queue.currentPatient.name}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-xs text-slate-500 mb-0.5">{fmt12(queue.currentPatient.appointmentTime)}</div>
                <div className="flex items-center gap-1 text-emerald-400 text-sm">
                  <Timer className="w-4 h-4" />
                  {queue.currentPatient.predictedDuration} min
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Queue List */}
        <div className="card">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-400" />
            Waiting Queue
            <span className="ml-auto text-xs text-slate-500 font-normal flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Auto-updates
            </span>
          </h3>

          {qLoading && <div className="text-center py-8 text-slate-500">Loading queue...</div>}

          {queue?.waitingPatients?.length === 0 && !qLoading && (
            <div className="text-center py-8 text-slate-500">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Queue is empty
            </div>
          )}

          <div className="space-y-2">
            {queue?.waitingPatients?.map((p) => {
              const isMe = myPatient?._id === p._id
              return (
                <div key={p._id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                    ${isMe ? 'border-brand-500/40 bg-brand-500/10' : 'border-white/5 bg-white/5'}`}>
                  {/* Appointment time badge instead of position number */}
                  <div className={`text-xs font-mono px-2 py-1 rounded-lg shrink-0
                    ${isMe ? 'bg-brand-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {fmt12(p.appointmentTime)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium text-sm ${isMe ? 'text-brand-400' : 'text-slate-200'}`}>
                      {isMe ? 'You' : p.name} {isMe && <span className="text-xs text-slate-400">(You)</span>}
                    </div>
                    <div className="text-xs text-slate-500">{p.visitType}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-slate-500">~{p.predictedDuration} min</div>
                    {p.expectedConsultationTime && (
                      <div className="text-xs text-brand-400">
                        est. {new Date(p.expectedConsultationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    <div className={`text-xs font-medium ${p.source === 'walkin' ? 'text-amber-400' : 'text-slate-500'}`}>
                      {p.source === 'walkin' ? 'Walk-In' : 'Appt'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="stat-card">
      <Icon className={`w-5 h-5 ${color}`} />
      <div className={`text-xl font-bold ${color} truncate`}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub truncate">{sub}</div>}
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
