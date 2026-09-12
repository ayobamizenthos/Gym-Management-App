'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, Share2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { useToasts } from '@/stores/toast'
import { useCached } from '@/hooks/useCached'
import { UsernameField } from '@/components/UsernameField'
import { playReward } from '@/lib/sounds'
import { shortDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Settings } from '@/lib/types'

interface Invited {
  id: string
  qualified_at: string | null
  rewarded_at: string | null
  created_at: string
  referred: { full_name: string | null } | null
}

export default function ReferralsPage() {
  const { profile, refresh } = useAuth()
  const push = useToasts(s => s.push)
  const [rows, setRows] = useState<Invited[]>([])
  const [copied, setCopied] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [wanted, setWanted] = useState('')
  const [wantedOk, setWantedOk] = useState(false)
  // window and navigator are read after mount so the server and client render
  // the same markup on the first pass.
  const [origin, setOrigin] = useState('')
  const [canShare, setCanShare] = useState(false)

  const { data: settings } = useCached<Settings>('settings', async () => {
    const { data } = await supabase.from('settings').select('*').maybeSingle()
    return data as Settings
  })

  useEffect(() => {
    setOrigin(window.location.origin)
    setCanShare(typeof navigator.share === 'function')
  }, [])

  useEffect(() => {
    if (!profile) return
    void supabase
      .from('referrals')
      .select('id, qualified_at, rewarded_at, created_at, referred:referred_id(full_name)')
      .eq('referrer_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as Invited[]))
  }, [profile])

  const target = settings?.referral_target ?? 3
  const reward = settings?.referral_reward_days ?? 7
  const counted = rows.filter(r => r.qualified_at && !r.rewarded_at).length
  const earned = rows.filter(r => r.rewarded_at).length

  const link = origin && profile?.username ? origin + '/join?ref=' + profile.username : ''

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      playReward()
      setTimeout(() => setCopied(false), 1800)
    } catch {
      push({ tone: 'info', title: 'Copy it by hand', message: 'This browser blocked the clipboard.' })
    }
  }

  const share = async () => {
    try {
      await navigator.share({ title: 'Train with me', text: 'Join me at the gym.', url: link })
    } catch {
      // the sheet was dismissed - nothing to report
    }
  }

  const claimName = async () => {
    setClaiming(true)
    const { error } = await supabase.rpc('claim_username', { p_username: wanted.trim().toLowerCase() })
    setClaiming(false)
    if (error) {
      push({ tone: 'bad', title: 'Could not set name', message: error.message })
      return
    }
    push({ tone: 'good', title: 'Your link is ready' })
    await refresh()
  }

  return (
    <div className="animate-rise">
      <h1 className="text-3xl lg:text-4xl">Invite &amp; earn</h1>
      <p className="mt-2 text-[15px] text-chalk-dim">
        When {target} people you invite pay for a monthly plan or longer, you get {reward} free days.
      </p>

      {!profile?.username ? (
        <section className="mt-7 rounded-lg bg-base-panel p-4">
          <p className="text-[15px]">Pick your username first.</p>
          <div className="mt-3">
            <UsernameField
              required
              label=""
              hint="3-20 letters, numbers or underscore. You sign in with it too. Cannot be changed."
              value={wanted}
              onChange={setWanted}
              onStateChange={setWantedOk}
            />
          </div>
          <button onClick={claimName} disabled={claiming || !wantedOk} className="btn-primary mt-3 w-full">
            {claiming ? <span className="dots">Saving</span> : 'Claim this username'}
          </button>
        </section>
      ) : (
        <section className="mt-7">
          <p className="text-xs uppercase tracking-[0.2em] text-mute">Your link</p>
          <div className="mt-2 flex items-stretch overflow-hidden rounded-md bg-base-panel">
            <span className="min-w-0 flex-1 truncate px-4 py-3.5 text-sm">{link || ' '}</span>
            <button
              onClick={() => void copy()}
              disabled={!link}
              className="flex shrink-0 items-center gap-2 bg-base-raised px-4 text-sm font-semibold uppercase text-live disabled:opacity-40"
            >
              {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          {canShare && (
            <button onClick={() => void share()} disabled={!link} className="btn-quiet mt-3 w-full">
              <Share2 size={17} aria-hidden /> Share link
            </button>
          )}
        </section>
      )}

      <section className="mt-9">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-[0.2em] text-mute">Progress</span>
          <span className="text-xs uppercase tracking-[0.2em] text-mute">{counted} of {target}</span>
        </div>
        <div
          className="mt-3 flex gap-1.5"
          role="img"
          aria-label={counted + ' of ' + target + ' invites counted'}
        >
          {Array.from({ length: target }).map((_, i) => (
            <span key={i} className={cn('h-2 flex-1 rounded-full transition-colors', i < counted ? 'bg-live' : 'bg-edge')} />
          ))}
        </div>
        {earned > 0 && (
          <p className="mt-3 text-sm text-live">
            {Math.floor(earned / target) * reward} free days earned so far.
          </p>
        )}
      </section>


      <section className="mt-6">
        <h2 className="text-2xl">People you invited</h2>
        {rows.length === 0 ? (
          <p className="mt-4 text-[15px] text-mute">Nobody yet. Share your link.</p>
        ) : (
          <ul role="list" className="mt-4 flex flex-col gap-2">
            {rows.map(r => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-base-panel px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{r.referred?.full_name ?? 'New member'}</span>
                  <span className="block text-xs text-mute">Joined {shortDate(r.created_at)}</span>
                </span>
                <span className={cn('shrink-0 text-xs font-semibold uppercase tracking-wide',
                  r.qualified_at ? 'text-live' : 'text-mute')}>
                  {r.rewarded_at ? 'Rewarded' : r.qualified_at ? 'Counted' : 'Not yet paid'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
