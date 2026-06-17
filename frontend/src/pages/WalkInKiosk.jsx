/**
 * WalkInKiosk — Read-only Clinic Status Display
 * Walk-in patients must approach the reception desk to be registered.
 * This page shows live clinic status and queue info only.
 */
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Users, Clock, CheckCircle2, Stethoscope, Heart, UserPlus, Activity } from 'lucide-react'
import DoctorStatusBadge from '../components/DoctorStatusBadge'
import { getClinic, getQueue } from '../services/api'
import { useSocket } from '../hooks/useSocket'

export default function WalkInKiosk() {
  const { clinicId } = useParams()
  const qc = useQueryClient()

  const { data: clinic } = useQuery({ queryKey: ['clinic'], queryFn: getClinic, refetchInterval: 15000 })
  const { data: queue, isLoading } = useQuery({ queryKey: ['queue'], queryFn: getQueue, refetchInterval: 10000 })

  useSocket('queueUpdated', () => qc.invalidateQueries({ queryKey: ['queue'] }))
  useSocket('doctorStatusChanged', () => qc.invalidateQueries({ queryKey: ['clinic'] }))

  const isOpen = clinic?.currentStatus === 'available' || clinic?.currentStatus === 'break'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="max-w-sm w-full space-y-5">
        {/* Clinic Header */}
        <div className="text-center animate-fade-in">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-500 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-brand-500/30">
            <Stethoscope className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">{clinic?.name || 'MediCare Clinic'}</h1>
          <p className="text-slate-400 text-sm mb-3">{clinic?.doctorName} · {clinic?.specialization}</p>
          <div className="flex justify-center">
            <DoctorStatusBadge status={clinic?.currentStatus || 'available'} size="md" />
          </div>
        </div>

        {/* Live Queue Stats */}
        <div className="glass rounded-2xl p-5 animate-slide-up">
          <h2 className="text-sm font-semibold text-slate-300 mb-4 text-center uppercase tracking-wider">Live Queue Status</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-3xl font-black text-amber-400">{queue?.queueLength || 0}</div>
              <div className="text-xs text-slate-500 mt-1">In Queue</div>
            </div>
            <div className="border-x border-white/10">
              <div className="text-3xl font-black text-brand-400">{queue?.totalWaitMinutes || 0}<span className="text-lg font-semibold">m</span></div>
              <div className="text-xs text-slate-500 mt-1">Est. Wait</div>
            </div>
            <div>
              <div className="text-3xl font-black text-emerald-400">{queue?.completedPatients?.length || 0}</div>
              <div className="text-xs text-slate-500 mt-1">Seen Today</div>
            </div>
          </div>
        </div>

        {/* Currently Being Served */}
        {queue?.currentPatient && (
          <div className="glass rounded-xl p-4 border border-emerald-500/20 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <span className="pulse-dot green" />
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Now Being Served</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Activity className="w-4.5 h-4.5 text-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{queue.currentPatient.name}</div>
                <div className="text-xs text-slate-400">{queue.currentPatient.visitType}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-xs text-slate-500">Expected</div>
                <div className="text-sm font-bold text-emerald-400">{queue.currentPatient.predictedDuration} min</div>
              </div>
            </div>
          </div>
        )}

        {/* Walk-In Instruction Banner */}
        <div className={`rounded-2xl p-5 border text-center animate-scale-in ${
          isOpen
            ? 'bg-brand-500/10 border-brand-500/20'
            : 'bg-red-500/10 border-red-500/20'
        }`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 ${
            isOpen ? 'bg-brand-500/20' : 'bg-red-500/20'
          }`}>
            <UserPlus className={`w-6 h-6 ${isOpen ? 'text-brand-400' : 'text-red-400'}`} />
          </div>
          {isOpen ? (
            <>
              <h3 className="text-base font-bold text-white mb-1">Walk-In Welcome</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Please approach the <span className="text-brand-400 font-semibold">reception desk</span> to register as a walk-in patient.
              </p>
              <p className="text-xs text-slate-500 mt-2">The receptionist will assign you the next available slot.</p>
            </>
          ) : (
            <>
              <h3 className="text-base font-bold text-white mb-1">Clinic Currently Closed</h3>
              <p className="text-sm text-slate-400">
                {clinic?.statusReason || 'The clinic is not accepting walk-ins at this time.'}
              </p>
            </>
          )}
        </div>

        {/* Next Few in Queue */}
        {queue?.waitingPatients?.length > 0 && (
          <div className="card">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Up Next</h3>
            <div className="space-y-2">
              {queue.waitingPatients.slice(0, 4).map((p, i) => (
                <div key={p._id} className="flex items-center gap-3 text-sm">
                  <div className="text-xs font-mono text-brand-400 w-16 shrink-0">
                    {fmt12(p.appointmentTime)}
                  </div>
                  <div className="flex-1 text-slate-300">{p.visitType}</div>
                  <div className="text-xs text-slate-500">{p.predictedDuration}m</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-slate-600">
          Powered by <span className="text-brand-500">MediCare AI</span>
        </p>
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
