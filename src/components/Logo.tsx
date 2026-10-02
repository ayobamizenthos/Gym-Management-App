import { cn } from '@/lib/cn'

const RATIO = 1160 / 200

interface Props {
  height?: number
  className?: string
  /** Over a photograph the white logo always reads; elsewhere it follows the phone's theme. */
  onPhoto?: boolean
}

/** The Zenthos mark and name: white on dark screens, near-black on light ones. */
export function Logo({ height = 24, className, onPhoto = false }: Props) {
  const width = Math.round(height * RATIO)
  return (
    <picture className={cn('block shrink-0', className)}>
      {!onPhoto && <source srcSet="/logo-dark.png" media="(prefers-color-scheme: light)" />}
      <img src="/logo.png" alt="Zenthos" width={width} height={height} className="block" style={{ width, height }} />
    </picture>
  )
}
