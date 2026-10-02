'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { playReward, playSetDone, unlockAudio } from '@/lib/sounds'
import { motionNeedsPermission, requestMotion, useShake } from '@/hooks/useShake'
import { useModal } from '@/hooks/useModal'
import { Logo } from '@/components/Logo'
import { Confetti } from '@/components/workouts/Confetti'
import { cn } from '@/lib/cn'

// a waiting gift is looked for when the app opens and every minute after
const CHECK_EVERY_MS = 60_000
const SETTLE_MS = 900
const RATTLE_MS = 700
const SWING_BUZZ_MS = 18
const OPEN_BUZZ = [40, 30, 90]
// shaking is the way to open it; the tap appears only for phones that cannot shake
const TAP_FALLBACK_MS = 6000

type Stage = 'waiting' | 'opening' | 'open'
interface Gift {
  id: string
  days: number
}

// confetti that stays after the burst, so a screenshot of the card still looks like a party
const SPRINKLE = [
  'left-[8%] top-[14%] rotate-[20deg] bg-live',
  'left-[12%] top-[86%] -rotate-[30deg] bg-[#F7B733]',
  'left-[22%] top-[8%] rotate-[55deg] bg-chalk',
  'left-[82%] top-[18%] -rotate-[15deg] bg-[#F7B733]',
  'left-[90%] top-[62%] rotate-[35deg] bg-live',
  'left-[74%] top-[88%] -rotate-[50deg] bg-chalk',
  'left-[50%] top-[8%] rotate-[10deg] bg-live',
  'left-[6%] top-[46%] rotate-[70deg] bg-[#F7B733]',
  'left-[94%] top-[38%] -rotate-[65deg] bg-chalk',
  'left-[44%] top-[90%] rotate-[25deg] bg-live',
]

/** A phone held upright and swung left and right, the shake the sensor listens for, with the gift on its screen. */
function ShakePhone({ rattling }: { rattling: boolean }) {
  return (
    <div className="relative flex h-full items-center justify-center">
      <Arcs side="left" rattling={rattling} />
      <div className={cn('origin-[50%_85%] motion-reduce:animate-none', rattling ? 'animate-phone-rattle' : 'animate-phone-shake')}>
        <svg width="104" height="176" viewBox="0 0 104 176" fill="none" aria-hidden>
          <rect x="3" y="3" width="98" height="170" rx="20" fill="#141417" stroke="#F6F6F3" strokeWidth="6" />
          <rect x="38" y="11" width="28" height="6" rx="3" fill="#F6F6F3" />
          <rect x="24" y="86" width="56" height="44" rx="5" fill="#35D07F" />
          <rect x="19" y="72" width="66" height="18" rx="5" fill="#27B86A" />
          <rect x="47" y="72" width="10" height="58" fill="#F7B733" />
          <path d="M52 72c-7-13-21-14-21-5 0 6 12 6 21 5Z" fill="#F7B733" />
          <path d="M52 72c7-13 21-14 21-5 0 6-12 6-21 5Z" fill="#F7B733" />
        </svg>
      </div>
      <Arcs side="right" rattling={rattling} />
    </div>
  )
}

function Arcs({ side, rattling }: { side: 'left' | 'right'; rattling: boolean }) {
  return (
    <svg
      width="34"
      height="70"
      viewBox="0 0 34 70"
      fill="none"
      aria-hidden
      className={cn(side === 'left' ? 'mr-3' : 'ml-3 -scale-x-100', 'motion-reduce:hidden', rattling ? 'opacity-100' : 'animate-arcs')}
    >
      <path d="M28 6C14 18 14 52 28 64" stroke="#35D07F" strokeWidth="5" strokeLinecap="round" />
      <path d="M12 18C4 28 4 42 12 52" stroke="#35D07F" strokeWidth="5" strokeLinecap="round" opacity="0.55" />
    </svg>
  )
}

function Sheet({ gift, onClose }: { gift: Gift; onClose: () => void }) {
  const router = useRouter()
  const panel = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState<Stage>('waiting')
  const [rattling, setRattling] = useState(false)
  const [needsTap, setNeedsTap] = useState(() => motionNeedsPermission())
  const [shakeReady, setShakeReady] = useState(() => !motionNeedsPermission())
  const [tapOffered, setTapOffered] = useState(false)
  const [days, setDays] = useState(gift.days)
  const rattleTimer = useRef(0)
  useModal(panel, onClose)

  const unwrap = useCallback(async () => {
    if (stage !== 'waiting') return
    setStage('opening')
    setRattling(true)
    const [{ data }] = await Promise.all([
      supabase.rpc('open_referral_gift', { p_gift: gift.id }),
      new Promise(resolve => window.setTimeout(resolve, RATTLE_MS)),
    ])
    setRattling(false)
    if (!data) return onClose()
    setDays(Number(data))
    setStage('open')
    playReward()
    navigator.vibrate?.(OPEN_BUZZ)
  }, [stage, gift.id, onClose])

  const onSwing = useCallback(() => {
    if (stage !== 'waiting') return
    setRattling(true)
    playSetDone()
    navigator.vibrate?.(SWING_BUZZ_MS)
    window.clearTimeout(rattleTimer.current)
    rattleTimer.current = window.setTimeout(() => setRattling(false), 260)
  }, [stage])

  useEffect(() => {
    if (stage !== 'waiting') return
    const timer = window.setTimeout(() => setTapOffered(true), TAP_FALLBACK_MS)
    return () => window.clearTimeout(timer)
  }, [stage])

  useShake(shakeReady && stage === 'waiting', onSwing, () => void unwrap())

  const allowShake = async () => {
    unlockAudio()
    const allowed = await requestMotion()
    setNeedsTap(false)
    if (allowed) setShakeReady(true)
    else void unwrap()
  }

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-base/70 backdrop-blur-[2px]" onClick={stage === 'open' ? onClose : undefined}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={stage === 'open' ? 'Your free week' : 'A gift for you'}
        onClick={event => event.stopPropagation()}
        className="w-full max-w-md animate-rise rounded-t-xl bg-base-panel ring-1 ring-black/15 dark:ring-white/10 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-center"
      >
        <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-full bg-edge" />
        {stage === 'open' ? (
          <>
            <div className="relative h-[270px] w-full overflow-hidden rounded-xl bg-[#0A0A0B]">
              {SPRINKLE.map(piece => (
                <span key={piece} aria-hidden className={cn('absolute h-2 w-3.5 rounded-[2px]', piece)} />
              ))}
              <div className="relative flex h-full animate-rise flex-col items-center justify-center px-6">
                <Logo height={20} onPhoto />
                <span className="figure mt-5 text-[76px] text-live">{days} days</span>
                <span className="mt-2 text-[17px] font-semibold leading-snug text-[#F6F6F3]">free on your membership</span>
                <span className="mt-1 text-[14px] text-[#8A8A93]">3 friends joined on your invite</span>
              </div>
            </div>
            <Confetti originX={typeof window === 'undefined' ? 0 : window.innerWidth / 2} originY={typeof window === 'undefined' ? 0 : window.innerHeight * 0.55} />
            <button
              type="button"
              onClick={() => {
                onClose()
                router.push('/m')
              }}
              className="btn-primary mt-5 w-full"
            >
              Start training
            </button>
          </>
        ) : (
          <>
            <div className="h-[230px] w-full overflow-hidden rounded-xl bg-live-tint ring-1 ring-black/10 dark:ring-0">
              <ShakePhone rattling={rattling} />
            </div>
            <h2 className="mt-5 text-[30px]">{needsTap ? 'Tap, then shake' : 'Shake your phone'}</h2>
            <p className="mt-1.5 text-[15px] text-chalk-dim">Three friends joined. Your free week is inside.</p>
            {needsTap && (
              <button type="button" onClick={() => void allowShake()} className="btn-primary mt-5 w-full">
                Tap to start
              </button>
            )}
            {(tapOffered || stage === 'opening') && (
              <button
                type="button"
                onClick={() => {
                  unlockAudio()
                  void unwrap()
                }}
                disabled={stage !== 'waiting'}
                className="mt-3 min-h-[44px] text-[14px] font-semibold underline underline-offset-4"
              >
                {stage === 'opening' ? 'Opening…' : 'Tap to open instead'}
              </button>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

/** A free week earned from three paid referrals, waiting to be shaken open. */
export function ReferralGift() {
  const { profile } = useAuth()
  const [gift, setGift] = useState<Gift | null>(null)
  const [open, setOpen] = useState(false)

  const look = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('referral_gifts')
      .select('id, days')
      .eq('user_id', profile.id)
      .is('opened_at', null)
      .order('created_at')
      .limit(1)
      .maybeSingle()
    if (data) {
      setGift(data as Gift)
      setOpen(true)
    }
  }, [profile])

  useEffect(() => {
    if (!profile || open) return
    const first = window.setTimeout(() => void look(), SETTLE_MS)
    const again = window.setInterval(() => void look(), CHECK_EVERY_MS)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(again)
    }
  }, [profile, open, look])

  if (!open || !gift) return null
  return <Sheet gift={gift} onClose={() => setOpen(false)} />
}
