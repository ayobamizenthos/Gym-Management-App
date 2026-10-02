// Door audio, synthesised so there is nothing to download. The four check-in
// outcomes differ in shape as well as pitch so they are distinguishable across
// a noisy room.

import type { CheckInKind } from './types'

let ctx: AudioContext | null = null
let master: GainNode | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) {
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = 1
    // keeps loud cues from clipping on phone speakers
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -8
    limiter.knee.value = 6
    limiter.ratio.value = 12
    limiter.attack.value = 0.003
    limiter.release.value = 0.18
    master.connect(limiter)
    limiter.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

let speechUnlocked = false

function unlockSpeech() {
  if (speechUnlocked) return
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try {
    const silent = new SpeechSynthesisUtterance(' ')
    silent.volume = 0
    window.speechSynthesis.speak(silent)
    speechUnlocked = true
  } catch {
    // no engine here; the chime carries the meaning on its own
  }
}

/** Browsers keep audio muted until a gesture. Call once on first tap. */
export function unlockAudio() {
  primeVoice()
  unlockSpeech()
  const ac = audio()
  if (!ac || !master) return
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  amp.gain.value = 0.0001
  osc.connect(amp)
  amp.connect(master)
  osc.start()
  osc.stop(ac.currentTime + 0.01)
}

interface Voice {
  freq: number
  to?: number
  at?: number
  dur: number
  gain?: number
  type?: OscillatorType
  /** Adds a second oscillator a touch sharp, which thickens a thin tone. */
  fat?: boolean
}

function play(voices: Voice[]) {
  const ac = audio()
  if (!ac || !master) return
  const now = ac.currentTime + 0.01

  for (const v of voices) {
    const start = now + (v.at ?? 0)
    const peak = v.gain ?? 0.2
    const detunes = v.fat ? [0, 7] : [0]

    for (const cents of detunes) {
      const osc = ac.createOscillator()
      const amp = ac.createGain()
      osc.type = v.type ?? 'triangle'
      osc.detune.value = cents
      osc.frequency.setValueAtTime(v.freq, start)
      if (v.to && v.to !== v.freq) osc.frequency.exponentialRampToValueAtTime(v.to, start + v.dur)

      const level = peak / detunes.length
      amp.gain.setValueAtTime(0.0001, start)
      amp.gain.exponentialRampToValueAtTime(level, start + 0.008)
      amp.gain.setValueAtTime(level, start + v.dur * 0.55)
      amp.gain.exponentialRampToValueAtTime(0.0001, start + v.dur)

      osc.connect(amp)
      amp.connect(master)
      osc.start(start)
      osc.stop(start + v.dur + 0.05)
    }
  }
}

/** A short filtered noise burst used as the attack of a cue. */
function strike(at = 0, level = 0.13, decay = 0.09, colour = 2600) {
  const ac = audio()
  if (!ac || !master) return
  const start = ac.currentTime + 0.01 + at
  const frames = Math.floor(ac.sampleRate * decay)
  const buffer = ac.createBuffer(1, frames, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i += 1) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 3)
  }
  const source = ac.createBufferSource()
  source.buffer = buffer
  const band = ac.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = colour
  band.Q.value = 0.8
  const amp = ac.createGain()
  amp.gain.value = level
  source.connect(band)
  band.connect(amp)
  amp.connect(master)
  source.start(start)
}

// Spoken words follow the chime; without a speech engine the chime plays alone.
let preferred: SpeechSynthesisVoice | null = null

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const all = window.speechSynthesis.getVoices()
  const english = all.filter(v => /^en(-|_|$)/i.test(v.lang))
  const pool = english.length > 0 ? english : all
  // a local engine answers instantly; a network one can arrive after the member
  const local = pool.filter(v => v.localService)
  const candidates = local.length > 0 ? local : pool
  if (candidates.length === 0) return null
  // prefer a lower, announcer-style voice where the platform has one
  const wanted = /(daniel|alex|arthur|oliver|google uk english male|guy|david|mark|male|man)/i
  return candidates.find(v => wanted.test(v.name)) ?? candidates[0]
}

/** Voices load asynchronously; asking before they arrive returns an empty list. */
export function primeVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const attempt = () => { preferred = pickVoice() }
  attempt()
  if (!preferred) {
    window.speechSynthesis.addEventListener('voiceschanged', attempt, { once: true })
    window.setTimeout(attempt, 1200)
  }
}

let announcing = false

function announce(words: string, delay = 0, { rate = 0.92, pitch = 0.85 } = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  unlockSpeech()
  if (announcing) window.speechSynthesis.cancel()

  window.setTimeout(() => {
    try {
      const line = new SpeechSynthesisUtterance(words)
      if (!preferred) preferred = pickVoice()
      if (preferred) {
        // lang first: assigning it after the voice detaches the voice on iOS
        line.lang = preferred.lang
        line.voice = preferred
      }
      line.rate = rate
      line.pitch = pitch
      line.volume = 1
      announcing = true
      line.onend = () => { announcing = false }
      line.onerror = () => { announcing = false }
      window.speechSynthesis.speak(line)
    } catch {
      // no speech engine on this device - the chime already carried the meaning
    }
  }, delay)
}

const C5 = 523.25
const E5 = 659.25
const G5 = 783.99
const C6 = 1046.5
const E6 = 1318.51
const G6 = 1567.98

/** Access granted: a C major arpeggio resolving to a held chord. */
export function playGranted() {
  play([
    { freq: C5, dur: 0.13, gain: 0.3, type: 'triangle', fat: true },
    { freq: E5, dur: 0.13, gain: 0.3, type: 'triangle', fat: true, at: 0.075 },
    { freq: G5, dur: 0.15, gain: 0.3, type: 'triangle', fat: true, at: 0.15 },

    { freq: C6, dur: 0.72, gain: 0.34, type: 'triangle', fat: true, at: 0.235 },
    { freq: E6, dur: 0.72, gain: 0.2, type: 'triangle', at: 0.235 },
    { freq: G6, dur: 0.72, gain: 0.13, type: 'sine', at: 0.235 },
    { freq: C5, dur: 0.78, gain: 0.16, type: 'sine', at: 0.235 },

    // bell partial an octave up
    { freq: C6 * 2, dur: 0.9, gain: 0.075, type: 'sine', at: 0.25 },
  ])
  strike(0, 0.1, 0.07, 3200)
  strike(0.235, 0.15, 0.14, 2400)
  announce('Access granted', 420)
}

/** Membership expired: a descending two-tone klaxon, three times. */
export function playExpired() {
  const blast = (at: number): Voice[] => [
    { freq: 415.3, to: 311.13, dur: 0.26, gain: 0.3, type: 'sawtooth', at },
    { freq: 207.65, to: 155.56, dur: 0.28, gain: 0.22, type: 'square', at },
    { freq: 103.8, dur: 0.3, gain: 0.16, type: 'sine', at },
  ]
  play([...blast(0), ...blast(0.34), ...blast(0.68)])
  strike(0, 0.1, 0.06, 900)
  strike(0.34, 0.1, 0.06, 900)
  strike(0.68, 0.1, 0.06, 900)
  announce('Membership expired', 980, { rate: 0.9, pitch: 0.72 })
}

/** Already checked in today: a short rising pair. */
export function playRepeat() {
  play([
    { freq: G5, dur: 0.1, gain: 0.2, type: 'triangle', fat: true },
    { freq: C6, dur: 0.18, gain: 0.18, type: 'triangle', fat: true, at: 0.1 },
  ])
  strike(0, 0.07, 0.05, 2800)
  announce('Already checked in', 340, { rate: 1, pitch: 0.9 })
}

/** No membership on file: a short falling pair. */
export function playNoMembership() {
  play([
    { freq: 587.33, to: 493.88, dur: 0.2, gain: 0.26, type: 'triangle', fat: true },
    { freq: 392, to: 329.63, dur: 0.32, gain: 0.22, type: 'triangle', at: 0.17 },
    { freq: 196, dur: 0.34, gain: 0.12, type: 'sine', at: 0.17 },
  ])
  strike(0, 0.08, 0.06, 1600)
  announce('No active subscription', 520)
}

/** Payment received: a rising flourish ending on an octave. */
export function playPaid() {
  play([
    { freq: E5, dur: 0.1, gain: 0.26, type: 'triangle', fat: true },
    { freq: G5, dur: 0.1, gain: 0.26, type: 'triangle', fat: true, at: 0.07 },
    { freq: C6, dur: 0.14, gain: 0.28, type: 'triangle', fat: true, at: 0.14 },
    { freq: E6, dur: 0.46, gain: 0.26, type: 'triangle', fat: true, at: 0.22 },
    { freq: C6, dur: 0.5, gain: 0.14, type: 'sine', at: 0.22 },
    { freq: E6 * 2, dur: 0.55, gain: 0.055, type: 'sine', at: 0.24 },
  ])
  strike(0, 0.09, 0.06, 3000)
  strike(0.22, 0.1, 0.1, 2600)
}

/** Reward unlocked: four rising steps. */
export function playReward() {
  play([
    { freq: C5, dur: 0.1, gain: 0.24, type: 'triangle', fat: true },
    { freq: E5, dur: 0.1, gain: 0.24, type: 'triangle', fat: true, at: 0.085 },
    { freq: G5, dur: 0.1, gain: 0.24, type: 'triangle', fat: true, at: 0.17 },
    { freq: C6, dur: 0.6, gain: 0.3, type: 'triangle', fat: true, at: 0.255 },
    { freq: G6, dur: 0.6, gain: 0.12, type: 'sine', at: 0.255 },
    { freq: C6 * 2, dur: 0.7, gain: 0.06, type: 'sine', at: 0.27 },
  ])
  strike(0.255, 0.13, 0.16, 3400)
}

/** A new member has paid and joined. */
export function playNewMember() {
  play([
    { freq: 392, to: C5, dur: 0.16, gain: 0.26, type: 'triangle', fat: true },
    { freq: C5, to: E5, dur: 0.16, gain: 0.26, type: 'triangle', fat: true, at: 0.13 },
    { freq: G5, dur: 0.5, gain: 0.26, type: 'triangle', fat: true, at: 0.27 },
    { freq: E6, dur: 0.5, gain: 0.11, type: 'sine', at: 0.27 },
  ])
  strike(0.27, 0.1, 0.12, 2600)
}

/** The desk plays the same cue the member hears at the door. */
export function playDeskAlert(kind: CheckInKind) {
  if (kind === 'valid') playGranted()
  else if (kind === 'expired') playExpired()
  else if (kind === 'duplicate') playRepeat()
  else playNoMembership()
}

// Boxing ring bell, tuned to a recorded ring bell: its overtones sit at these
// inharmonic ratios of a 1,666 Hz strike and each dies away at its own pace,
// which is what makes it ring rather than beep.
const BELL_PARTIALS = [
  { ratio: 1, gain: 0.3, decay: 1.7 },
  { ratio: 1.367, gain: 0.2, decay: 1.4 },
  { ratio: 1.443, gain: 0.14, decay: 1.3 },
  { ratio: 2.414, gain: 0.2, decay: 0.9 },
  { ratio: 4.35, gain: 0.3, decay: 0.55 },
  { ratio: 6.11, gain: 0.15, decay: 0.35 },
]
const RING_BELL_HZ = 1666
const RING_GAP_S = 0.24

function bell(at = 0, pitch = RING_BELL_HZ, level = 1, length = 1) {
  const ac = audio()
  if (!ac || !master) return
  const start = ac.currentTime + 0.01 + at
  for (const partial of BELL_PARTIALS) {
    const osc = ac.createOscillator()
    const amp = ac.createGain()
    osc.type = 'sine'
    // a slight beat between the strike and the ring, as on a real hammered bell
    osc.frequency.setValueAtTime(pitch * partial.ratio * 1.004, start)
    osc.frequency.exponentialRampToValueAtTime(pitch * partial.ratio, start + 0.08)
    amp.gain.setValueAtTime(0.0001, start)
    amp.gain.exponentialRampToValueAtTime(partial.gain * level, start + 0.004)
    amp.gain.exponentialRampToValueAtTime(0.0001, start + partial.decay * length)
    osc.connect(amp)
    amp.connect(master)
    osc.start(start)
    osc.stop(start + partial.decay * length + 0.05)
  }
  strike(at, 0.22 * level, 0.03, 5200)
}

/** The wrestling bell: three quick rings, the last left to ring out. */
function ringThrice() {
  bell(0, RING_BELL_HZ, 1, 0.5)
  bell(RING_GAP_S, RING_BELL_HZ, 1, 0.5)
  bell(RING_GAP_S * 2, RING_BELL_HZ, 1, 1.15)
}

/** The match starts: the bell rings three times as the workout begins. */
export function playWorkoutStart() {
  ringThrice()
}

/** A set ticked off: the short clink of a plate going on the bar. */
export function playSetDone() {
  bell(0, 3200, 0.4, 0.12)
  strike(0, 0.1, 0.025, 3800)
}

/** The last three seconds of rest, one pip each, like a gym interval timer. */
export function playCountdown() {
  play([{ freq: 1320, dur: 0.09, gain: 0.22, type: 'square' }])
}

/** Rest over: the same three rings, back to work. */
export function playRestOver() {
  ringThrice()
}

/** Workout saved: the bell, then a rising run into a wide, held major chord. */
export function playWorkoutDone() {
  bell(0, RING_BELL_HZ, 0.9, 1)
  play([
    { freq: C5, dur: 0.09, gain: 0.22, type: 'triangle', fat: true, at: 0.35 },
    { freq: E5, dur: 0.09, gain: 0.22, type: 'triangle', fat: true, at: 0.42 },
    { freq: G5, dur: 0.09, gain: 0.22, type: 'triangle', fat: true, at: 0.49 },
    { freq: C6, dur: 0.9, gain: 0.26, type: 'triangle', fat: true, at: 0.56 },
    { freq: E6, dur: 0.9, gain: 0.14, type: 'sine', at: 0.58 },
    { freq: G6, dur: 0.95, gain: 0.08, type: 'sine', at: 0.6 },
  ])
  strike(0.56, 0.14, 0.2, 3600)
}
