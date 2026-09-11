'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>()
  const doneRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

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

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        })
        streamRef.current = stream

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
        setReady(true)

        if (window.BarcodeDetector) {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
          const tick = async () => {
            if (doneRef.current) return
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
          { facingMode: 'environment' },
          { fps: 25, aspectRatio: 1.777 },
          text => finish(text),
          () => {}
        )
        setReady(true)
      } catch (e) {
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
      doneRef.current = true
      stop()
      void fallback?.stop().catch(() => {})
    }
  }, [finish, stop])

  return (
    <div className="relative overflow-hidden bg-black">
      <video ref={videoRef} muted playsInline className="h-[62vh] w-full object-cover" />
      <div id="scanner-fallback" className="absolute inset-0" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Corner brackets only - the whole frame is live, so no cropping box. */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="relative h-56 w-56">
          {['left-0 top-0 border-l-2 border-t-2', 'right-0 top-0 border-r-2 border-t-2',
            'left-0 bottom-0 border-l-2 border-b-2', 'right-0 bottom-0 border-r-2 border-b-2'].map(pos => (
            <span key={pos} className={`absolute h-8 w-8 border-good ${pos}`} />
          ))}
        </div>
      </div>

      {!ready && !error && (
        <p className="absolute inset-x-0 bottom-5 text-center text-sm text-white/70">Starting camera</p>
      )}
      {error && (
        <p className="absolute inset-x-0 bottom-5 px-6 text-center text-sm text-alert">{error}</p>
      )}
    </div>
  )
}
