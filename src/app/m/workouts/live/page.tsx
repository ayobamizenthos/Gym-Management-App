'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BellRing, ChevronDown, Dumbbell, Plus, X } from 'lucide-react'
import { Dialog } from '@/components/Dialog'
import { ExercisePicker } from '@/components/workouts/ExercisePicker'
import { LiveExerciseCard } from '@/components/workouts/LiveExerciseCard'
import { RestTimer } from '@/components/workouts/RestTimer'
import { useHydrated } from '@/hooks/useHydrated'
import { useNow } from '@/hooks/useNow'
import { useExercises } from '@/lib/exercises'
import { addToWorkout, swapInWorkout } from '@/lib/workout-session'
import { clock, volumeLabel } from '@/lib/workouts'
import type { FinishResult } from '@/lib/workouts'
import { enablePush, pushState } from '@/lib/push'
import { supabase } from '@/lib/supabase'
import { useToasts } from '@/stores/toast'
import { liveSetCount, liveVolume, sessionPayload, setNumber, useWorkout } from '@/stores/workout'

const PUSH_ASKED = 'zg:rest-push-asked'

type Confirm = 'unticked' | 'empty' | 'discard' | 'rename' | null

export default function LiveWorkoutPage() {
  const router = useRouter()
  const hydrated = useHydrated()
  const { session, previous, rename, discard, finished } = useWorkout()
  const { byId } = useExercises()
  const push = useToasts(state => state.push)
  const now = useNow(1000, session !== null)
  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'replace'; key: string } | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [saving, setSaving] = useState(false)
  const [askPush, setAskPush] = useState(false)

  useEffect(() => {
    if (hydrated && !session && !saving) router.replace('/m/workouts')
  }, [hydrated, session, saving, router])

  useEffect(() => {
    try {
      setAskPush(pushState() === 'default' && localStorage.getItem(PUSH_ASKED) === null)
    } catch {
      setAskPush(false)
    }
  }, [])

  const unticked = useMemo(
    () => session?.entries.reduce((sum, entry) => sum + entry.sets.filter(set => !set.done).length, 0) ?? 0,
    [session]
  )

  if (!hydrated || !session) return null

  const upNext = (entryKey: string, afterIndex: number) => {
    const at = session.entries.findIndex(entry => entry.key === entryKey)
    for (let e = at; e < session.entries.length; e += 1) {
      const entry = session.entries[e]
      const start = e === at ? afterIndex + 1 : 0
      for (let s = start; s < entry.sets.length; s += 1) {
        if (entry.sets[s].done) continue
        const name = byId.get(entry.exerciseId)?.name ?? 'next exercise'
        const kind = entry.sets[s].kind === 'warmup' ? 'Warm-up' : `Set ${setNumber(entry.sets, s)}`
        return { label: `${kind} of ${name}`, nextSet: setNumber(entry.sets, s) || 1 }
      }
    }
    return { label: 'Finish when you are ready', nextSet: 0 }
  }

  const save = async () => {
    const entries = sessionPayload(session)
    setSaving(true)
    const { data, error } = await supabase.rpc('finish_workout', {
      p_routine: session.routineId,
      p_name: session.name,
      p_started: new Date(session.startedAt).toISOString(),
      p_entries: entries,
    })
    if (error || !data) {
      setSaving(false)
      push({ tone: 'bad', title: 'Workout not saved yet', message: 'Check your connection and tap Finish again. Nothing has been lost.' })
      return
    }
    const result = data as FinishResult
    finished(result)
    router.replace(`/m/workouts/done/${result.id}`)
  }

  const finish = () => {
    if (sessionPayload(session).length === 0) return setConfirm('empty')
    if (unticked > 0) return setConfirm('unticked')
    void save()
  }

  const turnOnPush = async () => {
    try {
      localStorage.setItem(PUSH_ASKED, '1')
    } catch {}
    setAskPush(false)
    const state = await enablePush()
    if (state === 'granted') push({ tone: 'good', title: 'Rest alerts on', message: 'Your phone will buzz when rest is over, even with the app closed.' })
  }

  const dismissPush = () => {
    try {
      localStorage.setItem(PUSH_ASKED, '1')
    } catch {}
    setAskPush(false)
  }

  const elapsed = (now - session.startedAt) / 1000
  const recent = [...new Set(Object.keys(previous))]

  return (
    <div className="-mt-[var(--member-top)] pb-48">
      <header className="sticky top-0 z-30 -mx-5 bg-base/95 px-5 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="grid h-14 grid-cols-[48px_1fr_auto] items-center gap-2">
          <Link href="/m/workouts" aria-label="Minimise workout" className="-ml-2 grid h-11 w-11 place-items-center rounded-full active:bg-base-raised">
            <ChevronDown size={26} aria-hidden />
          </Link>
          <button type="button" onClick={() => setConfirm('rename')} className="truncate text-center text-[17px] font-bold">
            {session.name}
          </button>
          <button
            type="button"
            onClick={finish}
            disabled={saving}
            className="h-10 rounded-full bg-live px-5 text-[15px] font-semibold text-ink transition-transform active:scale-95 disabled:opacity-60"
          >
            {saving ? 'Saving' : 'Finish'}
          </button>
        </div>

        <dl className="grid grid-cols-[1.1fr_1.3fr_.7fr] pb-4 pt-2">
          <div>
            <dt className="label">Duration</dt>
            <dd className="figure mt-1.5 text-[28px] text-live">{clock(elapsed)}</dd>
          </div>
          <div>
            <dt className="label">Volume</dt>
            <dd className="figure mt-1.5 text-[28px]">{volumeLabel(liveVolume(session))}</dd>
          </div>
          <div>
            <dt className="label">Sets</dt>
            <dd className="figure mt-1.5 text-[28px]">{liveSetCount(session)}</dd>
          </div>
        </dl>
        <div className="-mx-5 h-px bg-edge-soft" />
      </header>

      {askPush && (
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-base-panel p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-live-tint text-live">
            <BellRing size={19} aria-hidden />
          </span>
          <p className="min-w-0 flex-1 text-[14px] leading-snug">Get a buzz when rest is over, even with the app closed.</p>
          <button type="button" onClick={turnOnPush} className="h-9 shrink-0 rounded-full bg-chalk px-4 text-[13px] font-semibold text-inverse">
            Turn on
          </button>
          <button type="button" onClick={dismissPush} aria-label="Not now" className="-mr-2 grid h-9 w-9 shrink-0 place-items-center text-mute">
            <X size={17} aria-hidden />
          </button>
        </div>
      )}

      {session.entries.length === 0 ? (
        <div className="flex flex-col items-center px-6 pb-4 pt-16 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-base-panel text-live">
            <Dumbbell size={28} aria-hidden />
          </span>
          <h2 className="mt-5 text-[28px]">Get started</h2>
          <p className="mt-2 text-[15px] text-mute">Add an exercise and log your first set. The clock is already running.</p>
        </div>
      ) : (
        session.entries.map((entry, index) => (
          <LiveExerciseCard
            key={entry.key}
            entry={entry}
            exercise={byId.get(entry.exerciseId)}
            previous={previous[entry.exerciseId]}
            first={index === 0}
            last={index === session.entries.length - 1}
            upNext={upNext}
            onReplace={() => setPicker({ mode: 'replace', key: entry.key })}
          />
        ))
      )}

      <button type="button" onClick={() => setPicker({ mode: 'add' })} className="btn-primary mt-7 w-full">
        <Plus size={19} aria-hidden />
        Add exercise
      </button>
      <button
        type="button"
        onClick={() => setConfirm('discard')}
        className="mt-3 h-12 w-full rounded-sm text-[15px] font-semibold text-out transition-colors active:bg-out-tint"
      >
        Discard workout
      </button>

      <RestTimer />

      {picker && (
        <ExercisePicker
          mode={picker.mode}
          recent={recent}
          onClose={() => setPicker(null)}
          onDone={ids => {
            if (picker.mode === 'replace') swapInWorkout(picker.key, ids[0])
            else addToWorkout(ids)
            setPicker(null)
          }}
        />
      )}

      {confirm === 'unticked' && (
        <Dialog
          title="Finish workout?"
          body={`${unticked} ${unticked === 1 ? 'set is' : 'sets are'} not ticked. Only ticked sets are saved.`}
          confirmLabel="Finish"
          onConfirm={save}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'empty' && (
        <Dialog
          title="Nothing logged yet"
          body="Tick a set to save it. If you are done for today, discard this workout."
          confirmLabel="Discard workout"
          tone="danger"
          onConfirm={() => discard()}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'discard' && (
        <Dialog
          title="Discard workout?"
          body="Everything logged in this session will be lost."
          confirmLabel="Discard"
          tone="danger"
          onConfirm={() => discard()}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'rename' && (
        <Dialog
          title="Name this workout"
          ask="Name"
          initial={session.name}
          confirmLabel="Save"
          onConfirm={reply => rename(reply.slice(0, 60))}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
