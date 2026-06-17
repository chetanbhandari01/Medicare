import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Calendar, Users, Clock, ChevronRight, Stethoscope, Heart, Activity, QrCode } from 'lucide-react'
import { useSocket } from '../hooks/useSocket'
import { getClinic, getQueue } from '../services/api'
import DoctorStatusBadge from '../components/DoctorStatusBadge'
import Navbar from '../components/Navbar'

export default function PatientHome() {
  const queryClient = useQueryClient()

  const { data: clinic, isLoading: cLoading } = useQuery({
    queryKey: ['clinic'],
    queryFn: getClinic,
    refetchInterval: 30000,
  })

  const { data: queue, isLoading: qLoading } = useQuery({
    queryKey: ['queue'],
    queryFn: getQueue,
    refetchInterval: 15000,
  })

  // Real-time socket events
  useSocket('queueUpdated',       () => queryClient.invalidateQueries({ queryKey: ['queue'] }))
  useSocket('doctorStatusChanged',() => queryClient.invalidateQueries({ queryKey: ['clinic'] }))
  useSocket('patientBooked',      () => queryClient.invalidateQueries({ queryKey: ['queue'] }))

  const waitMinutes = queue?.totalWaitMinutes || 0
  const queueLen    = queue?.queueLength || 0
  const status      = clinic?.currentStatus || 'available'

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-12 animate-fade-in">

          <h1 className="text-5xl sm:text-6xl font-black text-white mb-4 leading-tight">
            Skip the Wait.<br />
            <span className="gradient-text">Not the Care.</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Book appointments, track your queue in real-time, and know exactly when it's your turn.
          </p>
        </div>

        {/* Doctor Card */}
        <div className="max-w-2xl mx-auto mb-12 animate-slide-up">
          <div className="glass p-6 sm:p-8 rounded-2xl border border-white/10 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-500 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-brand-500/30">
              <Stethoscope className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-0.5">
              {cLoading ? '—' : clinic?.doctorName}
            </h2>
            <p className="text-slate-400 mb-4 text-sm">
              {cLoading ? '—' : clinic?.specialization}
            </p>
            <div className="flex justify-center mb-6">
              <DoctorStatusBadge status={status} size="md" />
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-6">
              <StatMini
                icon={Users}
                value={qLoading ? '—' : queueLen}
                label="In Queue"
                color="text-brand-400"
              />
              <StatMini
                icon={Clock}
                value={qLoading ? '—' : `${waitMinutes}m`}
                label="Est. Wait"
                color="text-amber-400"
              />
              <StatMini
                icon={Activity}
                value={qLoading ? '—' : (queue?.completedPatients?.length || 0)}
                label="Seen Today"
                color="text-emerald-400"
              />
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
          <ActionCard
            to="/book"
            icon={Calendar}
            title="Book Appointment"
            desc="Schedule a visit online at your preferred time"
            gradient="from-brand-500 to-teal-500"
          />
          <ActionCard
            to="/track"
            icon={Activity}
            title="Track Appointment"
            desc="View live queue status and your position"
            gradient="from-indigo-500 to-purple-500"
          />
          <ActionCard
            to={`/clinic/${clinic?.clinicId || 'clinic_001'}`}
            icon={QrCode}
            title="Walk-In Queue"
            desc="Join the queue directly if you're at the clinic"
            gradient="from-amber-500 to-orange-500"
          />
        </div>
      </section>

      {/* Live Queue Preview */}
      {queue?.currentPatient && (
        <section className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Currently Being Served</h3>
            <div className="glass p-4 rounded-xl border border-emerald-500/20 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <span className="pulse-dot green" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white">{queue.currentPatient.name}</div>
                <div className="text-xs text-slate-400">{queue.currentPatient.visitType}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Expected</div>
                <div className="text-sm font-medium text-emerald-400">{queue.currentPatient.predictedDuration} min</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-slate-600 border-t border-white/5">
        MediCare © {new Date().getFullYear()} · Smart Clinic Management
      </footer>
    </div>
  )
}

function StatMini({ icon: Icon, value, label, color }) {
  return (
    <div className="text-center">
      <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

function ActionCard({ to, icon: Icon, title, desc, gradient }) {
  return (
    <Link
      to={to}
      className="glass p-5 rounded-2xl border border-white/8 hover:border-white/15 transition-all duration-200 group hover:-translate-y-1 flex flex-col gap-3"
    >
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <div className="font-semibold text-white text-sm mb-1">{title}</div>
        <div className="text-xs text-slate-400 leading-relaxed">{desc}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors mt-auto" />
    </Link>
  )
}
