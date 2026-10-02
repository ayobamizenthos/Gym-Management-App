interface Point {
  at: string
  value: number
}

const WIDTH = 320
const HEIGHT = 96
const PAD = 6

/** A single line with a soft fill, newest point marked. Axis labels would only crowd a phone. */
export function ProgressChart({ points, label }: { points: Point[]; label: string }) {
  if (points.length === 0) return null
  const values = points.map(point => point.value)
  const low = Math.min(...values)
  const high = Math.max(...values)
  const span = high - low || 1
  const x = (index: number) => (points.length === 1 ? WIDTH / 2 : PAD + (index * (WIDTH - PAD * 2)) / (points.length - 1))
  const y = (value: number) => (high === low ? HEIGHT / 2 : HEIGHT - PAD - ((value - low) / span) * (HEIGHT - PAD * 2))
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`).join(' ')
  const last = points.length - 1

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mt-3 h-24 w-full overflow-visible" role="img" aria-label={label}>
      <defs>
        <linearGradient id="progress-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#35D07F" stopOpacity=".28" />
          <stop offset="1" stopColor="#35D07F" stopOpacity="0" />
        </linearGradient>
      </defs>
      {points.length > 1 && (
        <>
          <path d={`${line} L${x(last).toFixed(1)} ${HEIGHT} L${x(0).toFixed(1)} ${HEIGHT} Z`} fill="url(#progress-fill)" />
          <path d={line} fill="none" stroke="#35D07F" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="animate-trace" pathLength={100} />
        </>
      )}
      <circle cx={x(last)} cy={y(points[last].value)} r="5" fill="#35D07F" />
    </svg>
  )
}
