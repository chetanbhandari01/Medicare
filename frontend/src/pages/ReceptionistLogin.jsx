import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Heart, User, Lock, Eye, EyeOff, Loader2, ShieldCheck, Stethoscope, Activity } from 'lucide-react'
import toast from 'react-hot-toast'
import { login } from '../services/api'

export default function ReceptionistLogin() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)

  // If already logged in, redirect straight to dashboard
  useEffect(() => {
    const token = localStorage.getItem('medicare_token')
    if (token) navigate('/receptionist', { replace: true })
  }, [navigate])

  const mutation = useMutation({
    mutationFn: () => login(username, pin),
    onSuccess: (data) => {
      localStorage.setItem('medicare_token', data.token)
      localStorage.setItem('medicare_user', data.username)
      toast.success(`Welcome back, ${data.username}!`)
      navigate('/receptionist', { replace: true })
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Login failed. Check credentials.')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!username.trim() || !pin.trim()) {
      toast.error('Please enter username and PIN')
      return
    }
    mutation.mutate()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">

      {/* Ambient background orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-brand-500/5 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md animate-scale-in">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-500 to-indigo-500 shadow-2xl shadow-brand-500/40 mb-5 relative">
            <Heart className="w-10 h-10 text-white" fill="white" />
            {/* Glow ring */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-brand-500 to-indigo-500 blur-xl opacity-50 -z-10" />
          </div>
          <h1 className="text-3xl font-black text-white mb-1">MediCare</h1>
          <p className="text-slate-400 text-sm">Receptionist Portal</p>
        </div>

        {/* Login Card */}
        <div className="glass p-8 rounded-2xl border border-white/10 shadow-2xl">
          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck className="w-5 h-5 text-brand-400" />
            <h2 className="text-lg font-semibold text-white">Secure Login</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="receptionist-username"
                  type="text"
                  autoComplete="username"
                  placeholder="   Enter username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="input pl-10"
                  disabled={mutation.isPending}
                />
              </div>
            </div>

            {/* PIN */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                PIN
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="receptionist-pin"
                  type={showPin ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="   Enter PIN"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit(e)}
                  className="input pl-10 pr-12 tracking-widest"
                  maxLength={8}
                  disabled={mutation.isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              id="receptionist-login-btn"
              disabled={mutation.isPending}
              className="btn-primary w-full mt-2 py-3 text-base"
            >
              {mutation.isPending
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Signing In...</>
                : <><ShieldCheck className="w-5 h-5" /> Sign In to Dashboard</>
              }
            </button>
          </form>

          {/* Info hint */}
          <div className="mt-5 p-3 rounded-xl bg-white/5 border border-white/5">
            <p className="text-xs text-slate-500 text-center">
              Default: <span className="text-slate-400 font-mono">receptionist</span> / <span className="text-slate-400 font-mono">1234</span>
              <br />
            
            </p>
          </div>

        </div>

        {/* Feature Pills */}
        <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
          {[
            { icon: Stethoscope, label: 'Queue Mgmt' },
            { icon: Activity, label: 'Live Analytics' },
            { icon: ShieldCheck, label: 'Secure Access' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500 px-3 py-1 rounded-full glass border border-white/5">
              <Icon className="w-3 h-3 text-brand-500" />
              {label}
            </div>
          ))}
        </div>

        {/* Back link */}
        <div className="text-center mt-6">
          <a href="/" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
            ← Back to Patient Portal
          </a>
        </div>
      </div>
    </div>
  )
}
