'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Share, X } from 'lucide-react'
import { useModal } from '@/hooks/useModal'
import { useAuth } from '@/stores/auth'
import { useExercises } from '@/lib/exercises'
import { drawWorkoutCard } from '@/lib/share-card'
import { kgLabel, spoken, volumeLabel } from '@/lib/workouts'
import type { Workout } from '@/lib/workouts'
import { asName } from '@/lib/format'

interface Props {
  workout: Workout
  ordinal: number | null
  streakWeeks: number | null
  onClose: () => void
}

/** The finished workout as a picture, shared in one go with a line and the member's invite link. */
export function ShareSheet({ workout, ordinal, streakWeeks, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const { profile } = useAuth()
  const { byId } = useExercises()
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null)
  const [failed, setFailed] = useState(false)
  useModal(panel, onClose)

  const firstName = profile?.full_name?.split(' ')[0] ?? asName(profile?.username) ?? 'Me'
  const link = `${window.location.origin}/join${profile?.username ? `?ref=${profile.username}` : ''}`
  const record = workout.records?.[0]
  const recordName = record ? byId.get(record.exercise_id)?.name : null
  const brag = record && recordName
    ? `New PR: ${recordName} ${record.kind === 'reps' ? `${record.reps} reps` : kgLabel(record.kg ?? 0)} 🏆`
    : `${spoken((new Date(workout.ended_at).getTime() - new Date(workout.started_at).getTime()) / 1000)}, ${volumeLabel(Number(workout.volume_kg))} lifted 💪`
  const message = `${workout.name} done. ${brag} Train with me: ${link}`

  useEffect(() => {
    let live = true
    let made: string | null = null
    void drawWorkoutCard({ workout, ordinal, streakWeeks, memberName: firstName, exercises: byId, site: window.location.host }).then(blob => {
      if (!live) return
      if (!blob) return setFailed(true)
      made = URL.createObjectURL(blob)
      setCard({ blob, url: made })
    })
    return () => {
      live = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [workout, ordinal, streakWeeks, firstName, byId])

  const file = card ? new File([card.blob], `${workout.name.replace(/\W+/g, '-').toLowerCase()}.png`, { type: 'image/png' }) : null
  const canShareFile = Boolean(file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }))

  const share = async () => {
    try {
      // picture, line and link leave together, so they arrive as one message
      if (file && canShareFile) await navigator.share({ files: [file], text: message })
      else if (navigator.share) await navigator.share({ text: message })
      else await navigator.clipboard.writeText(message)
    } catch {
      // closing the share sheet is not an error
    }
  }

  const save = () => {
    if (!card) return
    const anchor = document.createElement('a')
    anchor.href = card.url
    anchor.download = file?.name ?? 'workout.png'
    // some browsers only honour a download link that is in the document
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-base/70 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Share your workout"
        onClick={event => event.stopPropagation()}
        className="w-full max-w-md animate-rise rounded-t-xl bg-base-panel ring-1 ring-black/15 dark:ring-white/10 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:rounded-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-body text-[17px] font-bold normal-case tracking-normal">Share your workout</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 grid h-11 w-11 place-items-center rounded-full text-mute active:bg-base-raised">
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="mx-auto mt-2 aspect-[4/5] w-full max-w-[300px] overflow-hidden rounded-lg bg-[#0A0A0B] shadow-lift">
          {card ? (
            // eslint-disable-next-line @next/next/no-img-element -- a picture drawn on the phone, not a file on the server
            <img src={card.url} alt={`${workout.name} summary`} className="h-full w-full animate-rise object-cover" />
          ) : failed ? (
            <p className="grid h-full place-items-center px-6 text-center text-[14px] text-mute">The picture could not be made. You can still share the text.</p>
          ) : (
            <div className="h-full w-full animate-pulse bg-base-raised" aria-busy="true" aria-label="Making your picture" />
          )}
        </div>

        <p className="mx-auto mt-3 max-w-[300px] text-center text-[13px] leading-snug text-mute">{message}</p>

        <div className="mt-4 flex gap-2.5">
          <button type="button" onClick={save} disabled={!card} className="btn-quiet flex-1">
            <Download size={18} aria-hidden />
            Save
          </button>
          <button type="button" onClick={share} disabled={!card && !failed} className="btn flex-[2] bg-live text-ink">
            <Share size={18} aria-hidden />
            Share
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
