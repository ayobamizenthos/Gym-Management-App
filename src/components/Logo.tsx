import Image from 'next/image'
import { cn } from '@/lib/cn'

const RATIO = 1160 / 200

/** The Zenthos mark and name, white, for dark surfaces. */
export function Logo({ height = 24, className }: { height?: number; className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Zenthos"
      width={Math.round(height * RATIO)}
      height={height}
      priority
      className={cn('block shrink-0', className)}
    />
  )
}
