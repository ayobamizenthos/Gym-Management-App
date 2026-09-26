'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { SwitchCamera } from 'lucide-react'
import type { Html5Qrcode } from 'html5-qrcode'

type Detector = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): Detector
      getSupportedFormats?: () => Promise<string[]>
    }
  }
}

interface Props {
  onResult: (value: string) => void
}

type Facing = 'environment' | 'user'

const FALLBACK_FPS = 25
const FALLBACK_ASPECT = 16 / 9

/** html5-qrcode rejects with strings, getUserMedia with DOMExceptions; both carry the reason name. */
function cameraProblem(error: unknown): string {
  const reason = error instanceof Error ? error.name + ' ' + error.message : String(error)
  if (/NotAllowed|Permission|Security/i.test(reason)) return 'Camera access was blocked. Allow the camera for this site, then try again.'
  if (/NotReadable|TrackStart|in use/i.test(reason)) return 'The camera is being used by another app. Close it and try again.'
  if (/NotFound|Overconstrained|DevicesNotFound/i.test(reason)) return 'No camera available on this device.'
  return 'The camera could not start. Try again.'
}

/**
 * Rear-camera QR reader tuned for speed over ceremony.
 *
 * Where the browser ships BarcodeDetector we use it directly against the raw
 * video frames - it is hardware accelerated, reads the whole frame rather than
 * a small centre box, and locks on from a distance without the user steadying
 * the phone. Older browsers fall back to a wasm decoder with the same framing.
 */
export function Scanner({ onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | undefined>(undefined)
  const doneRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [facing, setFacing] = useState<Facing>('environment')
  const [canSwitch, setCanSwitch] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const finish = useCallback(
    (value: string) => {
      if (doneRef.current) return
      doneRef.current = true
      onResult(value)
    },
    [onResult]
  )

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    let fallback: Html5Qrcode | null = null
    let cancelled = false

    // Labels only appear once permission is granted, so the count of real
    // cameras can only be taken after the stream opens.
    const countCameras = () =>
      navigator.mediaDevices
        .enumerateDevices()
        .then(devices => {
          if (!cancelled) setCanSwitch(devices.filter(d => d.kind === 'videoinput').length > 1)
        })
        .catch(() => {})

    const startNative = async (Detector: NonNullable<Window['BarcodeDetector']>) => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      })
      if (cancelled) {
        stream.getTracks().forEach(track => track.stop())
        return
      }
      streamRef.current = stream
      void countCameras()

      // Continuous autofocus keeps close and far codes sharp; a camera that refuses it still scans.
      const track = stream.getVideoTracks()[0]
      const caps = track.getCapabilities?.() as Record<string, unknown> | undefined
      if (caps && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
        await track
          .applyConstraints({ advanced: [{ focusMode: 'continuous' }] } as unknown as MediaTrackConstraints)
          .catch(() => {})
      }

      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      video.setAttribute('playsinline', 'true')
      await video.play()
      if (cancelled) return
      setReady(true)

      const detector = new Detector({ formats: ['qr_code'] })
      const tick = async () => {
        if (doneRef.current || cancelled) return
        try {
          const codes = await detector.detect(video)
          if (codes.length > 0 && codes[0].rawValue) {
            finish(codes[0].rawValue)
            return
          }
        } catch {
          // a dropped frame is not fatal; keep scanning
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    // Browsers without BarcodeDetector decode frames in wasm; the reader opens the camera itself.
    const startFallback = async () => {
      const { Html5Qrcode: Reader } = await import('html5-qrcode')
      if (cancelled) return
      const reader = new Reader('scanner-fallback', { verbose: false })
      fallback = reader
      await reader.start({ facingMode: facing }, { fps: FALLBACK_FPS, aspectRatio: FALLBACK_ASPECT }, finish, () => {})
      if (cancelled) return
      setReady(true)
      void countCameras()
    }

    setError(null)
    const Detector = window.BarcodeDetector
    void (Detector ? startNative(Detector) : startFallback()).catch(problem => {
      if (!cancelled) setError(cameraProblem(problem))
    })

    return () => {
      cancelled = true
      stop()
      void fallback?.stop().catch(() => {})
    }
  }, [finish, stop, facing, attempt])

  const flip = () => {
    setReady(false)
    setFacing(current => (current === 'environment' ? 'user' : 'environment'))
  }

  const retry = () => {
    setReady(false)
    setAttempt(n => n + 1)
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        muted
        playsInline
        className={`h-full w-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`}
      />
      <div id="scanner-fallback" className="absolute inset-0" />

      {/* Corner brackets only - the whole frame is live, so no cropping box. */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="relative h-56 w-56">
          {['left-0 top-0 border-l-2 border-t-2', 'right-0 top-0 border-r-2 border-t-2',
            'left-0 bottom-0 border-l-2 border-b-2', 'right-0 bottom-0 border-r-2 border-b-2'].map(pos => (
            <span key={pos} className={`absolute h-8 w-8 rounded-[3px] border-white/90 ${pos}`} />
          ))}
        </div>
      </div>

      {/* Sits where a camera app puts it: bottom right, clear of the brackets
          and of the status line that runs along the bottom centre. */}
      {canSwitch && !error && (
        <button
          onClick={flip}
          aria-label={facing === 'environment' ? 'Switch to front camera' : 'Switch to back camera'}
          className="absolute bottom-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.75rem))] right-5 grid h-12 w-12 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md transition-transform active:scale-90"
        >
          <SwitchCamera size={21} aria-hidden />
        </button>
      )}

      {!ready && !error && (
        <p className="absolute inset-x-0 top-1/2 mt-24 text-center text-sm text-white/70">Starting camera</p>
      )}
      {error && (
        <div className="absolute inset-x-0 top-1/2 mt-24 flex flex-col items-center gap-4 px-8 text-center">
          <p role="alert" className="text-sm text-out">{error}</p>
          <button onClick={retry} className="btn h-11 border border-white/25 px-5 text-sm text-white">Try again</button>
        </div>
      )}
    </div>
  )
}
