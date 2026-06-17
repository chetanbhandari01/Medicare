import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Clock, User, Phone, ChevronRight, ChevronLeft, CheckCircle2, Timer, Sparkles, Loader2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import Navbar from '../components/Navbar'
import { getSlots, bookAppointment, getClinic } from '../services/api'
import { format, addDays } from 'date-fns'

const VISIT_TYPES = [
  'General Consultation', 'Fever', 'Diabetes', 'Blood Pressure',
  'Skin Consultation', 'Child Consultation', 'Follow-up', 'First Visit'
]

const STEPS = ['Patient Info', 'Choose Date', 'Choose Slot', 'Confirm']

export default function BookAppointment() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    name: '', age: '', gender: 'Male', phone: '', visitType: '', notes: '', firstVisit: true,
    appointmentDate: format(new Date(), 'yyyy-MM-dd'),
    appointmentTime: '',
    predictedDuration: 0,
    confidenceRange: 0,
  })
  const [booked, setBooked] = useState(null)

  const { data: clinic } = useQuery({ queryKey: ['clinic'], queryFn: getClinic })

  // Available slots query
  const { data: slotsData, isLoading: slotsLoading, error: slotsError } = useQuery({
    queryKey: ['slots', form.appointmentDate, form.visitType, form.age, form.firstVisit],
    queryFn: () => getSlots({ date: form.appointmentDate, visitType: form.visitType, age: form.age, firstVisit: form.firstVisit }),
    enabled: step === 2 && !!form.visitType && !!form.age,
  })

  const mutation = useMutation({
    mutationFn: bookAppointment,
    onSuccess: (data) => {
      setBooked(data.patient)
      queryClient.invalidateQueries({ queryKey: ['queue'] })
      toast.success('Appointment booked successfully!')
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Booking failed. Please try again.')
    },
  })

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }))

  const canNext = () => {
    if (step === 0) return form.name && form.age && form.phone && form.visitType
    if (step === 1) return form.appointmentDate
    if (step === 2) return form.appointmentTime
    return true
  }

  const handleSlotSelect = (slot) => {
    set('appointmentTime', slot.time)
    set('predictedDuration', slot.predictedDuration)
    set('confidenceRange', slot.confidenceRange)
  }

  const handleSubmit = () => {
    mutation.mutate({ ...form, age: parseInt(form.age) })
  }

  // Generate date options (next 14 days)
  const dateOptions = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(new Date(), i)
    return { value: format(d, 'yyyy-MM-dd'), label: format(d, 'EEE, MMM d'), isToday: i === 0 }
  })

  if (booked) return <BookingConfirmation patient={booked} onNew={() => navigate('/book')} onTrack={() => navigate('/track')} />

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">

        {/* Header */}
        <div className="page-header text-center">
          <h1 className="page-title">Book Appointment</h1>
          <p className="page-subtitle">with {clinic?.doctorName || 'Dr. Sarah Johnson'}</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-0 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className={`flex flex-col items-center gap-1 ${i <= step ? 'text-brand-400' : 'text-slate-600'}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all
                  ${i < step ? 'bg-brand-500 border-brand-500 text-white' : i === step ? 'border-brand-500 text-brand-400' : 'border-slate-700 text-slate-600'}`}>
                  {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <span className="text-xs font-medium hidden sm:block">{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${i < step ? 'bg-brand-500' : 'bg-slate-800'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 0: Patient Info */}
        {step === 0 && (
          <div className="card space-y-4 animate-slide-up">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <User className="w-5 h-5 text-brand-400" /> Patient Information
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1.5">Full Name *</label>
                <input className="input" placeholder="e.g. Rajan Mehta" value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Age *</label>
                <input className="input" type="number" min="0" max="120" placeholder="Age" value={form.age} onChange={e => set('age', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Gender</label>
                <select className="select" value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Phone Number *</label>
                <input className="input" type="tel" placeholder="e.g. 9876543210" value={form.phone} onChange={e => set('phone', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Visit Type *</label>
                <select className="select" value={form.visitType} onChange={e => set('visitType', e.target.value)}>
                  <option value="">Select type...</option>
                  {VISIT_TYPES.map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1.5">Is this your first visit?</label>
                <div className="flex gap-3">
                  {['Yes', 'No'].map(opt => (
                    <button key={opt} onClick={() => set('firstVisit', opt === 'Yes')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all
                        ${(opt === 'Yes') === form.firstVisit ? 'bg-brand-500/20 border-brand-500/50 text-brand-400' : 'border-white/10 text-slate-400 hover:border-white/20'}`}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1.5">Notes (optional)</label>
                <textarea className="input resize-none h-20" placeholder="Any specific concerns..." value={form.notes} onChange={e => set('notes', e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Choose Date */}
        {step === 1 && (
          <div className="card animate-slide-up">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-brand-400" /> Choose Date
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {dateOptions.map(d => (
                <button key={d.value} onClick={() => set('appointmentDate', d.value)}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all
                    ${form.appointmentDate === d.value ? 'bg-brand-500/20 border-brand-500/50 text-brand-400' : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'}`}>
                  {d.isToday ? 'Today' : d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Choose Slot */}
        {step === 2 && (
          <div className="card animate-slide-up">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-1">
              <Clock className="w-5 h-5 text-brand-400" /> Available Slots
            </h2>
            <p className="text-xs text-slate-500 mb-4 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-brand-500" />
              Slots generated dynamically using AI-predicted consultation durations
            </p>

            {slotsLoading && (
              <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
                Generating smart slots...
              </div>
            )}

            {slotsError && (
              <div className="flex items-center gap-2 text-red-400 py-4">
                <AlertCircle className="w-4 h-4" />
                Failed to load slots. Please try again.
              </div>
            )}

            {slotsData && !slotsData.available && (
              <div className="text-amber-400 text-sm py-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {slotsData.reason}
              </div>
            )}

            {slotsData?.slots && (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
                  {slotsData.slots.map(slot => (
                    <button key={slot.time} onClick={() => handleSlotSelect(slot)}
                      className={`p-2.5 rounded-xl border text-center transition-all
                        ${form.appointmentTime === slot.time ? 'bg-brand-500/20 border-brand-500/50 text-brand-400' : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'}`}>
                      <div className="text-sm font-semibold">{slot.displayTime}</div>
                      <div className="text-xs text-slate-500">{slot.predictedDuration}min</div>
                    </button>
                  ))}
                </div>
                {slotsData.slots.length === 0 && (
                  <div className="text-center py-10">
                    <Clock className="w-10 h-10 mx-auto mb-3 text-slate-700" />
                    <p className="text-slate-400 text-sm font-medium mb-1">
                      {form.appointmentDate === format(new Date(), 'yyyy-MM-dd')
                        ? 'No remaining slots for today'
                        : 'No available slots for this date'}
                    </p>
                    <p className="text-slate-600 text-xs">
                      {form.appointmentDate === format(new Date(), 'yyyy-MM-dd')
                        ? 'All today\'s slots have passed or are booked. Please choose tomorrow or another date.'
                        : 'All slots are booked for this date. Please try a different date.'}
                    </p>
                  </div>
                )}
                {form.appointmentTime && (
                  <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-3 flex items-center gap-3">
                    <Timer className="w-4 h-4 text-brand-400 shrink-0" />
                    <div className="text-sm">
                      <span className="text-slate-400">AI Prediction: </span>
                      <span className="font-semibold text-white">{form.predictedDuration} min</span>
                      <span className="text-slate-500"> ±{form.confidenceRange} min</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="card animate-slide-up space-y-4">
            <h2 className="text-lg font-semibold text-white">Confirm Booking</h2>
            <div className="space-y-3 text-sm">
              {[
                ['Patient', form.name],
                ['Age / Gender', `${form.age} yrs · ${form.gender}`],
                ['Phone', form.phone],
                ['Visit Type', form.visitType],
                ['Date', form.appointmentDate],
                ['Time', form.appointmentTime],
                ['First Visit', form.firstVisit ? 'Yes' : 'No'],
                ['Est. Duration', `${form.predictedDuration} min ±${form.confidenceRange} min`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-2 border-b border-white/5">
                  <span className="text-slate-400">{label}</span>
                  <span className="font-medium text-slate-200">{value}</span>
                </div>
              ))}
            </div>
            {form.notes && <p className="text-xs text-slate-500">Notes: {form.notes}</p>}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button onClick={() => setStep(s => s - 1)} disabled={step === 0}
            className="btn-secondary" style={{ visibility: step === 0 ? 'hidden' : 'visible' }}>
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canNext()} className="btn-primary">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Booking...</> : <><CheckCircle2 className="w-4 h-4" /> Confirm Booking</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function BookingConfirmation({ patient, onNew, onTrack }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full card text-center animate-scale-in">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-500 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-brand-500/30">
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">Appointment Confirmed!</h2>
        <p className="text-slate-400 text-sm mb-6">Your appointment has been successfully booked.</p>

        <div className="glass-dark rounded-xl p-5 mb-6 text-left space-y-3">
          <div className="text-center mb-2">
            <div className="text-xs text-slate-500 mb-1">Appointment ID</div>
            <div className="text-3xl font-black text-brand-400 font-mono tracking-widest">{patient.appointmentId}</div>
          </div>
          {[
            ['Date', patient.appointmentDate],
            ['Time', patient.appointmentTime],
            ['Duration', `${patient.predictedDuration} min ±${patient.confidenceRange} min`],
          ].map(([l, v]) => (
            <div key={l} className="flex justify-between text-sm border-b border-white/5 pb-2">
              <span className="text-slate-400">{l}</span>
              <span className="text-white font-medium">{v}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500 mb-6">Save your Appointment ID to track your visit status anytime.</p>

        <div className="flex gap-3">
          <button onClick={onNew} className="btn-secondary flex-1">Book Another</button>
          <button onClick={onTrack} className="btn-primary flex-1">Track Appointment</button>
        </div>
      </div>
    </div>
  )
}
