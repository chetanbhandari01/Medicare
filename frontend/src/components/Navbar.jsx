import { Heart, Stethoscope, Menu, X, LogIn } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'

const NAV_LINKS = [
  { href: '/',          label: 'Home' },
  { href: '/book',      label: 'Book Appointment' },
  { href: '/track',     label: 'Track Appointment' },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-dark border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:shadow-brand-500/40 transition-shadow">
              <Heart className="w-5 h-5 text-white" fill="white" />
            </div>
            <div>
              <span className="text-lg font-bold gradient-text">MediCare</span>
              <span className="hidden sm:block text-xs text-slate-500 -mt-0.5">Smart Clinic System</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                to={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150
                  ${pathname === link.href
                    ? 'bg-brand-500/20 text-brand-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
              >
                {link.label}
              </Link>
            ))}
            <Link to="/login" className="ml-2 btn-secondary py-2 text-xs">
              <LogIn className="w-3.5 h-3.5" />
              Receptionist
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5" onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {open && (
          <div className="md:hidden py-3 border-t border-white/5 space-y-1 animate-slide-up">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setOpen(false)}
                className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${pathname === link.href ? 'bg-brand-500/20 text-brand-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
              >
                {link.label}
              </Link>
            ))}
            <Link to="/receptionist" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-indigo-400 hover:bg-white/5 rounded-lg">
              Receptionist Dashboard
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}
