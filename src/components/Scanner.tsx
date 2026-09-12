'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { SwitchCamera } from 'lucide-react'

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
  const rafRef = useRef<number>()
  const doneRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [facing, setFacing] = useState<Facing>('environment')
  const [canSwitch, setCanSwitch] = useState(false)

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
    let fallback: { stop: () => Promise<void> } | null = null
    let cancelled = false

    const start = async () => {
      try {
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

        // Labels only appear once permission is granted, so the count of real
        // cameras can only be taken after the stream opens.
        void navigator.mediaDevices
          .enumerateDevices()
          .then(devices => {
            if (!cancelled) setCanSwitch(devices.filter(d => d.kind === 'videoinput').length > 1)
          })
          .catch(() => {})

        // Continuous autofocus keeps close and far codes sharp without tapping.
        const track = stream.getVideoTracks()[0]
        const caps = track.getCapabilities?.() as Record<string, unknown> | undefined
        if (caps && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] } as unknown as MediaTrackConstraints)
        }

        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        video.setAttribute('playsinline', 'true')
        await video.play()
        if (cancelled) return
        setReady(true)
        setError(null)

        if (window.BarcodeDetector) {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
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
          return
        }

        // Fallback: decode frames with the wasm reader, still full frame.
        const { Html5Qrcode } = await import('html5-qrcode')
        const reader = new Html5Qrcode('scanner-fallback', {
          verbose: false,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        })
        fallback = reader as unknown as { stop: () => Promise<void> }
        stop()
        await reader.start(
          { facingMode: facing },
          { fps: 25, aspectRatio: 1.777 },
          text => finish(text),
          () => {}
        )
        if (!cancelled) setReady(true)
      } catch (e) {
        if (cancelled) return
        const name = (e as Error).name
        setError(
          name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow the camera and try again.'
            : 'No camera available on this device.'
        )
      }
    }

    void start()
    return () => {
      cancelled = true
      stop()
      void fallback?.stop().catch(() => {})
    }
  }, [finish, stop, facing])

  const flip = () => {
    setReady(false)
    setFacing(current => (current === 'environment' ? 'user' : 'environment'))
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
        <p className="absolute inset-x-0 top-1/2 mt-24 px-8 text-center text-sm text-out">{error}</p>
      )}
    </div>
  )
}
