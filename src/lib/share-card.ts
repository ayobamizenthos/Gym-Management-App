'use client'

import { TROPHY, GOLD, GOLD_DEEP, GOLD_LIGHT } from '@/lib/trophy'
import { clock, kgLabel, secondsBetween } from '@/lib/workouts'
import type { PersonalBest, RoutineEntry, Workout } from '@/lib/workouts'
import { isBodyweight } from '@/lib/exercises'
import type { Exercise } from '@/lib/exercises'

// Portrait 4:5, the size Instagram, WhatsApp status and X all show uncropped.
const W = 1080
const H = 1350
const PAD = 72
const INK = '#0A0A0B'
const PANEL = '#17171B'
const CHALK = '#F6F6F3'
const MUTE = '#8A8A93'
const LIVE = '#35D07F'
const MAX_EXERCISES = 5

interface CardInput {
  workout: Workout
  ordinal: number | null
  streakWeeks: number | null
  memberName: string
  exercises: Map<string, Exercise>
  site: string
}

function load(src: string) {
  return new Promise<HTMLImageElement | null>(resolve => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}

function fontOf(selector: string) {
  const probe = document.createElement(selector === 'display' ? 'h1' : 'p')
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  document.body.appendChild(probe)
  const family = getComputedStyle(probe).fontFamily
  probe.remove()
  return family
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  context.beginPath()
  context.roundRect(x, y, w, h, r)
  context.fillStyle = fill
  context.fill()
}

function ordinal(n: number) {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

function fit(context: CanvasRenderingContext2D, text: string, max: number) {
  if (context.measureText(text).width <= max) return text
  let cut = text
  while (cut.length > 1 && context.measureText(cut + '…').width > max) cut = cut.slice(0, -1)
  return cut + '…'
}

function drawTrophy(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  context.save()
  context.translate(x, y)
  context.scale(size / 64, size / 64)
  const gold = context.createLinearGradient(0, 0, 64, 64)
  gold.addColorStop(0, GOLD_LIGHT)
  gold.addColorStop(0.55, GOLD)
  gold.addColorStop(1, GOLD_DEEP)
  context.lineCap = 'round'
  context.lineWidth = 4
  context.strokeStyle = gold
  context.stroke(new Path2D(TROPHY.handles))
  context.fillStyle = GOLD_DEEP
  context.fill(new Path2D(TROPHY.stem))
  context.fill(new Path2D(TROPHY.plinth))
  context.fillStyle = gold
  context.fill(new Path2D(TROPHY.base))
  context.fill(new Path2D(TROPHY.cup))
  context.fillStyle = 'rgba(255,255,255,.35)'
  context.fill(new Path2D(TROPHY.shine))
  context.fillStyle = 'rgba(255,255,255,.95)'
  context.fill(new Path2D(TROPHY.star))
  context.restore()
}

const best = (entry: RoutineEntry, bodyweight: boolean) => {
  const working = entry.sets.filter(set => set.kind === 'normal')
  const top = [...(working.length ? working : entry.sets)].sort((a, b) => (b.kg ?? 0) - (a.kg ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0]
  if (!top) return ''
  return bodyweight || !top.kg ? `${top.reps} reps` : `${kgLabel(top.kg)} × ${top.reps}`
}

const recordLine = (record: PersonalBest) => (record.kind === 'reps' ? `${record.reps} reps` : `${kgLabel(record.kg ?? 0)} × ${record.reps}`)

/** The workout as a picture worth posting: trophy, numbers, bests, every exercise and the streak. */
export async function drawWorkoutCard(input: CardInput): Promise<Blob | null> {
  const { workout, ordinal: nth, streakWeeks, memberName, exercises, site } = input
  await document.fonts.ready
  const display = fontOf('display')
  const body = fontOf('body')

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const context = canvas.getContext('2d')
  if (!context) return null

  context.fillStyle = INK
  context.fillRect(0, 0, W, H)
  const glow = context.createRadialGradient(W / 2, 250, 0, W / 2, 250, 560)
  glow.addColorStop(0, 'rgba(53,208,127,.30)')
  glow.addColorStop(1, 'rgba(53,208,127,0)')
  context.fillStyle = glow
  context.fillRect(0, 0, W, H)

  const shown = workout.entries.slice(0, MAX_EXERCISES)
  const [logo, ...thumbs] = await Promise.all([load('/logo.png'), ...shown.map(entry => load(`/media/${entry.exercise_id}.gif`))])

  if (logo) context.drawImage(logo, PAD, 64, 174, 30)
  context.font = `600 26px ${body}`
  context.fillStyle = MUTE
  context.textAlign = 'right'
  context.fillText(new Date(workout.ended_at).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' }), W - PAD, 88)

  // trophy in a glowing ring
  context.beginPath()
  context.arc(W / 2, 236, 96, 0, Math.PI * 2)
  context.fillStyle = 'rgba(247,183,51,.12)'
  context.fill()
  context.lineWidth = 3
  context.strokeStyle = 'rgba(247,183,51,.45)'
  context.stroke()
  drawTrophy(context, W / 2 - 66, 170, 132)

  context.textAlign = 'center'
  context.fillStyle = CHALK
  context.font = `400 112px ${display}`
  context.fillText('WORKOUT DONE', W / 2, 452)
  context.font = `500 32px ${body}`
  context.fillStyle = MUTE
  const subtitle = [memberName, workout.name, nth ? `${ordinal(nth)} workout` : null].filter(Boolean).join(' · ')
  context.fillText(fit(context, subtitle, W - PAD * 2), W / 2, 506)

  // three stats
  const seconds = secondsBetween(workout.started_at, workout.ended_at)
  const stats = [
    [clock(seconds), 'Duration'],
    [Math.round(Number(workout.volume_kg)).toLocaleString('en-NG'), 'kg lifted'],
    [String(workout.set_count), workout.set_count === 1 ? 'Set' : 'Sets'],
  ]
  const gap = 20
  const boxW = (W - PAD * 2 - gap * 2) / 3
  stats.forEach(([value, label], index) => {
    const x = PAD + index * (boxW + gap)
    roundRect(context, x, 556, boxW, 150, 28, PANEL)
    context.fillStyle = CHALK
    context.font = `400 64px ${display}`
    context.fillText(value, x + boxW / 2, 640)
    context.fillStyle = MUTE
    context.font = `500 26px ${body}`
    context.fillText(label, x + boxW / 2, 682)
  })

  let y = 736
  const records = workout.records ?? []
  if (records.length > 0) {
    const first = records[0]
    roundRect(context, PAD, y, W - PAD * 2, 92, 26, 'rgba(247,183,51,.12)')
    context.textAlign = 'left'
    context.fillStyle = GOLD
    context.font = `700 30px ${body}`
    const label = records.length === 1 ? 'New personal best' : `${records.length} new personal bests`
    context.fillText(label, PAD + 30, y + 56)
    // the record on the right, its exercise squeezed into whatever room is left
    const record = recordLine(first)
    context.textAlign = 'right'
    context.fillStyle = CHALK
    context.font = `400 40px ${display}`
    context.fillText(record, W - PAD - 30, y + 60)
    const recordWidth = context.measureText(record).width
    context.font = `700 30px ${body}`
    const labelWidth = context.measureText(label).width
    context.font = `500 24px ${body}`
    context.fillStyle = MUTE
    const room = W - PAD * 2 - 60 - recordWidth - labelWidth - 48
    if (room > 80) context.fillText(fit(context, exercises.get(first.exercise_id)?.name ?? '', room), W - PAD - 30 - recordWidth - 18, y + 57)
    y += 112
  }

  // exercises with their pictures
  // rows grow to fill the card when the workout is short, so it never looks half empty
  const more = workout.entries.length > MAX_EXERCISES ? 30 : 0
  const reserve = (streakWeeks && streakWeeks > 1 ? 104 : 0) + 130 + more
  // rows share whatever height is left: roomy for a short workout, tighter for a long one
  const rowH = Math.max(64, Math.min(170, Math.floor((H - y - reserve - 40) / Math.max(1, shown.length))))
  const thumbSize = Math.min(rowH - 20, 130)
  const nameSize = rowH > 120 ? 36 : rowH < 80 ? 26 : 30
  const listH = shown.length * rowH + 40
  roundRect(context, PAD, y, W - PAD * 2, listH, 28, PANEL)
  shown.forEach((entry, index) => {
    const rowY = y + 20 + index * rowH
    const exercise = exercises.get(entry.exercise_id)
    const top = rowY + (rowH - thumbSize) / 2
    roundRect(context, PAD + 24, top, thumbSize, thumbSize, 18, '#FFFFFF')
    const thumb = thumbs[index]
    if (thumb) context.drawImage(thumb, PAD + 28, top + 4, thumbSize - 8, thumbSize - 8)
    const textX = PAD + 24 + thumbSize + 26
    const middle = rowY + rowH / 2
    context.textAlign = 'left'
    context.fillStyle = CHALK
    context.font = `600 ${nameSize}px ${body}`
    context.fillText(fit(context, exercise?.name ?? 'Exercise', W - PAD - 30 - textX), textX, middle - 4)
    context.fillStyle = MUTE
    context.font = `500 ${nameSize - 6}px ${body}`
    context.fillText(`${entry.sets.length} ${entry.sets.length === 1 ? 'set' : 'sets'} · best ${best(entry, isBodyweight(exercise))}`, textX, middle + nameSize)
  })
  y += listH + 20
  if (workout.entries.length > MAX_EXERCISES) {
    context.fillStyle = MUTE
    context.font = `500 24px ${body}`
    context.textAlign = 'center'
    context.fillText(`+${workout.entries.length - MAX_EXERCISES} more`, W / 2, y + 4)
    y += 24
  }

  // streak, then the sign-off
  if (streakWeeks && streakWeeks > 1 && y < H - 190) {
    roundRect(context, PAD, y, W - PAD * 2, 84, 26, PANEL)
    context.textAlign = 'left'
    context.fillStyle = CHALK
    context.font = `600 30px ${body}`
    context.fillText(`${streakWeeks} weeks in a row`, PAD + 30, y + 52)
    for (let index = 0; index < Math.min(streakWeeks, 8); index += 1) {
      roundRect(context, W - PAD - 30 - (index + 1) * 46 + 10, y + 36, 36, 12, 6, LIVE)
    }
  }

  context.textAlign = 'center'
  context.fillStyle = LIVE
  context.font = `700 28px ${body}`
  context.fillText(`Train with me · ${site}`, W / 2, H - 56)

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}
