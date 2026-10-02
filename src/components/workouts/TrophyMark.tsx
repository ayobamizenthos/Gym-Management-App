import { useId } from 'react'
import { GOLD, GOLD_DEEP, GOLD_LIGHT, TROPHY } from '@/lib/trophy'

/** A gold cup with a star, lit from the left, with a light that sweeps across it once it lands. */
export function TrophyMark({ size }: { size: number }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={GOLD_LIGHT} />
          <stop offset=".55" stopColor={GOLD} />
          <stop offset="1" stopColor={GOLD_DEEP} />
        </linearGradient>
        <linearGradient id={`${id}-sweep`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={TROPHY.cup} />
        </clipPath>
      </defs>
      <path d={TROPHY.handles} fill="none" stroke={`url(#${id}-gold)`} strokeWidth="4" strokeLinecap="round" />
      <path d={TROPHY.stem} fill={GOLD_DEEP} />
      <path d={TROPHY.base} fill={`url(#${id}-gold)`} />
      <path d={TROPHY.plinth} fill={GOLD_DEEP} />
      <path d={TROPHY.cup} fill={`url(#${id}-gold)`} />
      <path d={TROPHY.shine} fill="#fff" opacity=".35" />
      <path d={TROPHY.star} fill="#fff" opacity=".95" />
      <g clipPath={`url(#${id}-clip)`}>
        <rect x="-30" y="0" width="22" height="64" fill={`url(#${id}-sweep)`} transform="skewX(-18)">
          <animate attributeName="x" values="-30;80" dur="1.1s" begin="1.1s" fill="freeze" />
        </rect>
      </g>
    </svg>
  )
}
