import { Activity, Clock, XCircle, MinusCircle } from 'lucide-react'

const STATUS_CONFIG = {
  available:   { label: 'Available',    cls: 'status-available',   dot: 'green', Icon: Activity },
  break:       { label: 'On Break',     cls: 'status-break',       dot: 'amber', Icon: Clock },
  unavailable: { label: 'Unavailable',  cls: 'status-unavailable', dot: 'red',   Icon: XCircle },
  closed:      { label: 'Clinic Closed', cls: 'status-closed',     dot: 'gray',  Icon: MinusCircle },
}

export default function DoctorStatusBadge({ status = 'available', size = 'md' }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.available
  const { label, cls, dot, Icon } = config

  const sizeClasses = {
    sm: 'px-2 py-1 gap-1.5',
    md: 'px-2.5 py-1.5 gap-2',
    lg: 'px-3 py-2 gap-2.5',
  }[size]

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'

  return (
    <span
      title={label}
      className={`inline-flex items-center rounded-full font-medium transition-all duration-300 cursor-default ${cls} ${sizeClasses}`}
    >
      <span className={`pulse-dot ${dot} shrink-0`} />
      <Icon className={iconSize} />
      {label}
    </span>
  )
}
