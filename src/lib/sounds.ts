// Check-in audio. Every cue is synthesised so there are no files to download
// on a slow connection, and it still fires the instant a scan resolves.
//
// The three states must be distinguishable from across a busy gym floor, so
// they differ in shape, not just pitch: success rises, expiry is a repeating
// two-tone klaxon, repeat-entry is a soft neutral blip.

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Browsers block audio until a gesture. Call once on first tap. */
export function unlockAudio() {
  const ac = audio()
  if (!ac) return
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  amp.gain.value = 0.0001
  osc.connect(amp)
  amp.connect(ac.destination)
  osc.start()
  osc.stop(ac.currentTime + 0.01)
}

interface Tone {
  from: number
  to?: number
  at?: number
  dur: number
  gain?: number
  type?: OscillatorType
}

function play(tones: Tone[]) {
  const ac = audio()
  if (!ac) return
  const now = ac.currentTime
  for (const t of tones) {
    const start = now + (t.at ?? 0)
    const osc = ac.createOscillator()
    const amp = ac.createGain()
    osc.type = t.type ?? 'sine'
    osc.frequency.setValueAtTime(t.from, start)
    if (t.to && t.to !== t.from) osc.frequency.exponentialRampToValueAtTime(t.to, start + t.dur)
    const peak = t.gain ?? 0.18
    amp.gain.setValueAtTime(0.0001, start)
    amp.gain.exponentialRampToValueAtTime(peak, start + 0.012)
    amp.gain.exponentialRampToValueAtTime(0.0001, start + t.dur)
    osc.connect(amp)
    amp.connect(ac.destination)
    osc.start(start)
    osc.stop(start + t.dur + 0.04)
  }
}

/** Access granted - bright three-step climb, unmistakably positive. */
export function playGranted() {
  play([
    { from: 523.25, to: 659.25, dur: 0.11, type: 'triangle', gain: 0.24 },
    { from: 659.25, to: 783.99, dur: 0.11, type: 'triangle', gain: 0.24, at: 0.09 },
    { from: 783.99, to: 1046.5, dur: 0.26, type: 'triangle', gain: 0.22, at: 0.18 },
    { from: 1567.98, dur: 0.3, type: 'sine', gain: 0.07, at: 0.18 },
  ])
}

/** Membership expired - low two-tone klaxon, repeated. Impossible to miss. */
export function playExpired() {
  const blast = (at: number) => [
    { from: 392, to: 349.23, dur: 0.22, type: 'sawtooth' as OscillatorType, gain: 0.2, at },
    { from: 196, to: 174.61, dur: 0.24, type: 'square' as OscillatorType, gain: 0.12, at },
  ]
  play([...blast(0), ...blast(0.3), ...blast(0.6)])
}

/** Already checked in today - neutral, friendly, not an error. */
export function playRepeat() {
  play([
    { from: 587.33, dur: 0.09, type: 'sine', gain: 0.16 },
    { from: 587.33, dur: 0.12, type: 'sine', gain: 0.13, at: 0.15 },
  ])
}

/** No membership on file yet. */
export function playNoMembership() {
  play([
    { from: 440, to: 392, dur: 0.18, type: 'triangle', gain: 0.18 },
    { from: 330, to: 294, dur: 0.24, type: 'triangle', gain: 0.15, at: 0.16 },
  ])
}

/** Payment confirmed - short celebratory flourish. */
export function playPaid() {
  play([
    { from: 659.25, to: 987.77, dur: 0.12, type: 'triangle', gain: 0.2 },
    { from: 987.77, to: 1318.51, dur: 0.22, type: 'triangle', gain: 0.18, at: 0.1 },
    { from: 1975.53, dur: 0.28, type: 'sine', gain: 0.06, at: 0.1 },
  ])
}

/** Referral milestone reached. */
export function playReward() {
  play([
    { from: 523.25, dur: 0.1, type: 'triangle', gain: 0.18 },
    { from: 659.25, dur: 0.1, type: 'triangle', gain: 0.18, at: 0.1 },
    { from: 783.99, dur: 0.1, type: 'triangle', gain: 0.18, at: 0.2 },
    { from: 1046.5, dur: 0.34, type: 'triangle', gain: 0.2, at: 0.3 },
  ])
}

/** Desk alert when a member scans - carries across the room. */
export function playDeskAlert(kind: 'valid' | 'expired' | 'duplicate' | 'no_membership') {
  if (kind === 'valid') playGranted()
  else if (kind === 'expired') playExpired()
  else if (kind === 'duplicate') playRepeat()
  else playNoMembership()
}
