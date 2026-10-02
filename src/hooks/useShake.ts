'use client'

import { useEffect, useRef } from 'react'

// A firm side-to-side shake, the way the animation shows it: the phone upright, swung left and
// right. Walking, turning or lifting the phone stays well under this, so it never opens by accident.
const PEAK_MS2 = 8
const SWINGS_NEEDED = 3
const WINDOW_MS = 1500
const MIN_GAP_MS = 80
// how fast the gravity estimate follows the phone's tilt; the rest of the reading is the shake
const GRAVITY_FOLLOW = 0.92

type MotionPermission = { requestPermission?: () => Promise<'granted' | 'denied'> }

// iPads report themselves as Macs, so a touch screen is what gives them away
const isAppleTouch = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)

/**
 * iPhones only report motion after the member allows it, and that has to come from a tap.
 * Some other browsers carry the same API but grant motion freely, so only Apple devices ask.
 */
export const motionNeedsPermission = () =>
  typeof window !== 'undefined' &&
  isAppleTouch() &&
  typeof (window.DeviceMotionEvent as unknown as MotionPermission | undefined)?.requestPermission === 'function'

export async function requestMotion(): Promise<boolean> {
  const motion = window.DeviceMotionEvent as unknown as MotionPermission | undefined
  if (typeof motion?.requestPermission !== 'function') return true
  try {
    return (await motion.requestPermission()) === 'granted'
  } catch {
    return false
  }
}

/** Calls onSwing for each firm swing (to rattle the box) and onShake once a full shake lands. */
export function useShake(active: boolean, onSwing: () => void, onShake: () => void) {
  const handlers = useRef({ onSwing, onShake })
  useEffect(() => {
    handlers.current = { onSwing, onShake }
  }, [onSwing, onShake])

  useEffect(() => {
    if (!active || typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return
    let swings: number[] = []
    let lastSign = 0
    const gravity = { x: 0, y: 0, ready: false }

    const onMotion = (event: DeviceMotionEvent) => {
      // many Android phones only report motion with gravity in it, so gravity is filtered out here;
      // phones that do report pure motion are read directly, whichever shows the stronger swing
      const raw = event.accelerationIncludingGravity
      let x = 0
      let y = 0
      if (raw?.x != null && raw.y != null) {
        if (!gravity.ready) {
          gravity.x = raw.x
          gravity.y = raw.y
          gravity.ready = true
        }
        gravity.x = GRAVITY_FOLLOW * gravity.x + (1 - GRAVITY_FOLLOW) * raw.x
        gravity.y = GRAVITY_FOLLOW * gravity.y + (1 - GRAVITY_FOLLOW) * raw.y
        x = raw.x - gravity.x
        y = raw.y - gravity.y
      }
      const pure = event.acceleration
      if (pure?.x != null && Math.abs(pure.x) > Math.abs(x)) x = pure.x
      if (pure?.y != null && Math.abs(pure.y) > Math.abs(y)) y = pure.y

      // side to side mostly moves along the phone's width; a wrist twist can show up on its height
      const swing = Math.abs(x) >= Math.abs(y) ? x : y
      if (Math.abs(swing) < PEAK_MS2) return
      const sign = Math.sign(swing)
      const now = event.timeStamp || performance.now()
      if (sign === lastSign || (swings.length && now - swings[swings.length - 1] < MIN_GAP_MS)) return
      lastSign = sign
      swings = [...swings.filter(at => now - at < WINDOW_MS), now]
      handlers.current.onSwing()
      if (swings.length >= SWINGS_NEEDED) {
        swings = []
        handlers.current.onShake()
      }
    }

    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [active])
}
