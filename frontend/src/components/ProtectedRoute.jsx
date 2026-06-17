import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { verifyToken } from '../services/api'
import { Loader2, Heart } from 'lucide-react'

/**
 * ProtectedRoute — wraps pages that require receptionist login.
 * Checks localStorage token; verifies it with the backend on mount.
 * Redirects to /login if invalid or expired.
 */
export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState('checking') // 'checking' | 'ok' | 'denied'

  useEffect(() => {
    const token = localStorage.getItem('medicare_token')
    if (!token) {
      setStatus('denied')
      return
    }

    verifyToken()
      .then(data => setStatus(data.valid ? 'ok' : 'denied'))
      .catch(() => setStatus('denied'))
  }, [])

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center gap-3 text-slate-400">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-500 flex items-center justify-center shadow-lg">
          <Heart className="w-5 h-5 text-white" fill="white" />
        </div>
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
            Verifying access…
          </div>
          <div className="text-xs text-slate-600 mt-0.5">MediCare Receptionist Portal</div>
        </div>
      </div>
    )
  }

  if (status === 'denied') {
    return <Navigate to="/login" replace />
  }

  return children
}
