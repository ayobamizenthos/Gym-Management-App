/** A calendar page drawn in the system style: solid header band, binder tabs, one picked day. */
export function CalendarIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <rect x="3" y="4.5" width="18" height="16.5" rx="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.9 9.6h16.2V8a3.5 3.5 0 0 0-3.5-3.5H7.4A3.5 3.5 0 0 0 3.9 8v1.6Z" fill="currentColor" />
      <path d="M8 2.6v3.6M16 2.6v3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="6.6" y="12.7" width="4.2" height="4.2" rx="1.1" fill="currentColor" />
    </svg>
  )
}
