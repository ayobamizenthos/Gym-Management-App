'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, Share2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { useToasts } from '@/stores/toast'
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
  const [settings, setSettings] = useState<Settings | null>(null)
  const [rows, setRows] = useState<Invited[]>([])
  const [copied, setCopied] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [wanted, setWanted] = useState('')

  useEffect(() => {
    void supabase.from('settings').select('*').maybeSingle().then(({ data }) => setSettings(data as Settings))
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

  const link =
    typeof window !== 'undefined' && profile?.username
      ? window.location.origin + '/join?ref=' + profile.username
      : ''

  const copy = async () => {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    playReward()
    setTimeout(() => setCopied(false), 1800)
  }

  const claimName = async () => {
    setClaiming(true)
    const { error } = await supabase.rpc('claim_username', { p_username: wanted.trim().toLowerCase() })
    if (error) push({ tone: 'bad', title: 'Could not set name', message: error.message })
    else {
      push({ tone: 'good', title: 'Your link is ready' })
      await refresh()
    }
    setClaiming(false)
  }

  return (
    <div className="animate-rise">
      <h1 className="text-4xl">Invite &amp; earn</h1>
      <p className="mt-2 text-sm text-mute">
        When {target} people you invite pay for a monthly plan or longer, you get {reward} free days.
      </p>

      {!profile?.username ? (
        <section className="mt-7 border border-edge p-4">
          <p className="text-sm">Pick your link name first.</p>
          <div className="mt-3 flex gap-2">
            <input
              value={wanted}
              onChange={e => setWanted(e.target.value)}
              placeholder="yourname"
              className="field"
            />
            <button onClick={claimName} disabled={claiming || wanted.trim().length < 3} className="btn-primary px-5">
              {claiming ? '...' : 'Claim'}
            </button>
          </div>
          <p className="mt-2 text-xs text-mute">3-20 letters, numbers or underscore. Cannot be changed.</p>
        </section>
      ) : (
        <section className="mt-7">
          <p className="text-xs uppercase tracking-[0.2em] text-mute">Your link</p>
          <div className="mt-2 flex items-stretch border border-edge">
            <span className="min-w-0 flex-1 truncate px-4 py-3.5 text-sm">{link}</span>
            <button onClick={copy} className="flex items-center gap-2 border-l border-edge px-4 text-sm font-semibold uppercase text-live">
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              onClick={() => navigator.share({ title: 'Join me at the gym', url: link })}
              className="btn-quiet mt-3 w-full"
            >
              <Share2 size={17} /> Share link
            </button>
          )}
        </section>
      )}

      <section className="mt-9">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-[0.2em] text-mute">Progress</span>
          <span className="text-xs uppercase tracking-[0.2em] text-mute">
            {counted} of {target}
          </span>
        </div>
        <div className="mt-3 flex gap-1.5">
          {Array.from({ length: target }).map((_, i) => (
            <span key={i} className={cn('h-2 flex-1 transition-colors', i < counted ? 'bg-live' : 'bg-edge')} />
          ))}
        </div>
        {earned > 0 && (
          <p className="mt-3 text-sm text-live">
            {Math.floor(earned / target) * reward} free days earned so far.
          </p>
        )}
      </section>

      <div className="rule mt-9" />

      <section className="mt-6">
        <h2 className="text-2xl">People you invited</h2>
        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-mute">Nobody yet. Share your link.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {rows.map(r => (
              <li key={r.id} className="flex items-center justify-between border-l-2 border-edge bg-base-panel px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{r.referred?.full_name ?? 'New member'}</span>
                  <span className="block text-xs text-mute">Joined {shortDate(r.created_at)}</span>
                </span>
                <span className={cn('text-xs font-semibold uppercase tracking-wide',
                  r.rewarded_at ? 'text-live' : r.qualified_at ? 'text-live' : 'text-mute')}>
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
