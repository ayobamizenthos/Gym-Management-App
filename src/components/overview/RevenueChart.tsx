'use client'

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { naira } from '@/lib/format'

export interface Bucket {
  bucket: string
  total: number
}

const AXIS_INK = '#8A8A93'
const PEAK_FILL = '#35D07F'
const BAR_FILL = '#2C6A4E'
const CURSOR_FILL = 'rgba(53,208,127,.08)'
const AXIS_FONT_SIZE = 11
const MIN_TICK_GAP = 24
const MAX_BAR_SIZE = 44

interface Props {
  series: Bucket[]
  peak: number
  formatTick: (bucket: string) => string
}

export function RevenueChart({ series, peak, formatTick }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={series} margin={{ top: 6, right: 2, bottom: 0, left: 2 }}>
        <XAxis
          dataKey="bucket"
          tickFormatter={formatTick}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={MIN_TICK_GAP}
          tick={{ fill: AXIS_INK, fontSize: AXIS_FONT_SIZE }}
        />
        <Tooltip cursor={{ fill: CURSOR_FILL }} content={<ChartTip formatTick={formatTick} />} />
        <Bar dataKey="total" radius={[5, 5, 0, 0]} maxBarSize={MAX_BAR_SIZE}>
          {series.map(bucket => (
            <Cell key={bucket.bucket} fill={Number(bucket.total) === peak ? PEAK_FILL : BAR_FILL} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function ChartTip({
  active,
  payload,
  label,
  formatTick,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
  formatTick: (bucket: string) => string
}) {
  if (!active || !payload?.length || !label) return null
  return (
    <div className="rounded-sm border border-edge bg-base-raised px-3 py-2 shadow-lift">
      <p className="text-xs uppercase tracking-wide text-mute">{formatTick(label)}</p>
      <p className="font-display text-lg tabular-nums text-live">{naira(payload[0].value)}</p>
    </div>
  )
}
