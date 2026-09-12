// Door audio.
//
// This plays across a gym floor, over music, to someone who has just paid money
// and wants to feel it was worth it. Every cue is synthesised, so there is
// nothing to download on a slow connection and it fires the instant a scan
// resolves - but synthesised does not have to mean thin.
//
// The four door states differ in shape, not only pitch, so they are told apart
// from the far side of the room without looking:
//   granted  - a major arpeggio that lands on a held, shining chord
//   expired  - a descending two-tone klaxon, repeated, unmistakably a refusal
//   repeat   - a soft double blip, friendly, not an error
//   no plan  - a short falling pair, a question rather than an alarm

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
    // a gentle ceiling so a loud cue never clips into a rasp on a phone speaker
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

/** Browsers keep audio muted until a gesture. Call once on first tap. */
export function unlockAudio() {
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

/** A short filtered noise burst: the transient that makes a cue sound real
 *  rather than like a test tone. */
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

const C5 = 523.25
const E5 = 659.25
const G5 = 783.99
const C6 = 1046.5
const E6 = 1318.51
const G6 = 1567.98

/**
 * Access granted. A major arpeggio climbing to a held C major chord with a bell
 * on top - the sound of a barrier opening for someone who belongs here. This is
 * the one the whole floor hears.
 */
export function playGranted() {
  play([
    { freq: C5, dur: 0.13, gain: 0.3, type: 'triangle', fat: true },
    { freq: E5, dur: 0.13, gain: 0.3, type: 'triangle', fat: true, at: 0.075 },
    { freq: G5, dur: 0.15, gain: 0.3, type: 'triangle', fat: true, at: 0.15 },

    // the chord it lands on, held and open
    { freq: C6, dur: 0.72, gain: 0.34, type: 'triangle', fat: true, at: 0.235 },
    { freq: E6, dur: 0.72, gain: 0.2, type: 'triangle', at: 0.235 },
    { freq: G6, dur: 0.72, gain: 0.13, type: 'sine', at: 0.235 },
    { freq: C5, dur: 0.78, gain: 0.16, type: 'sine', at: 0.235 },

    // a bell struck over the top, which is what carries across a room
    { freq: C6 * 2, dur: 0.9, gain: 0.075, type: 'sine', at: 0.25 },
  ])
  strike(0, 0.1, 0.07, 3200)
  strike(0.235, 0.15, 0.14, 2400)
}

/** Membership expired. A low descending klaxon, three times. Nobody mistakes
 *  this for a welcome, and the desk hears it without looking up. */
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
}

/** Already in today. Warm, brief, clearly not a refusal. */
export function playRepeat() {
  play([
    { freq: G5, dur: 0.1, gain: 0.2, type: 'triangle', fat: true },
    { freq: C6, dur: 0.18, gain: 0.18, type: 'triangle', fat: true, at: 0.1 },
  ])
  strike(0, 0.07, 0.05, 2800)
}

/** No membership on file. A falling pair: a question, not an alarm. */
export function playNoMembership() {
  play([
    { freq: 587.33, to: 493.88, dur: 0.2, gain: 0.26, type: 'triangle', fat: true },
    { freq: 392, to: 329.63, dur: 0.32, gain: 0.22, type: 'triangle', at: 0.17 },
    { freq: 196, dur: 0.34, gain: 0.12, type: 'sine', at: 0.17 },
  ])
  strike(0, 0.08, 0.06, 1600)
}

/** Money in. A bright rising flourish that finishes on an octave. */
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

/** A reward unlocked. Four rising steps and a shine on the last. */
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

/** A new member has paid and joined. Warm and arriving, distinct from a scan. */
export function playNewMember() {
  play([
    { freq: 392, to: C5, dur: 0.16, gain: 0.26, type: 'triangle', fat: true },
    { freq: C5, to: E5, dur: 0.16, gain: 0.26, type: 'triangle', fat: true, at: 0.13 },
    { freq: G5, dur: 0.5, gain: 0.26, type: 'triangle', fat: true, at: 0.27 },
    { freq: E6, dur: 0.5, gain: 0.11, type: 'sine', at: 0.27 },
  ])
  strike(0.27, 0.1, 0.12, 2600)
}

/** Desk alert when a member scans: the same cue the member hears, so staff and
 *  member are reacting to one sound rather than two. */
export function playDeskAlert(kind: 'valid' | 'expired' | 'duplicate' | 'no_membership') {
  if (kind === 'valid') playGranted()
  else if (kind === 'expired') playExpired()
  else if (kind === 'duplicate') playRepeat()
  else playNoMembership()
}
