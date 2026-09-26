'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2, QrCode, RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToasts } from '@/stores/toast'
import { Accordion } from '@/components/Accordion'
import { Dialog } from '@/components/Dialog'
import { isStillReferenced } from '@/lib/db-errors'
import { plural } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Branch } from '@/lib/types'

const SKELETON_ROWS = 2
const EMPTY_DRAFT = { name: '', address: '', phone: '' }

async function memberCounts() {
  const { data } = await supabase.rpc('branch_member_counts')
  const rows = (data ?? []) as { branch_id: string | null; members: number }[]
  return Object.fromEntries(rows.filter(row => row.branch_id).map(row => [row.branch_id, Number(row.members)]))
}

export default function AdminBranches() {
  const push = useToasts(s => s.push)
  const [branches, setBranches] = useState<Branch[]>([])
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState<Branch | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('branches').select('*').order('name')
    const list = (data ?? []) as Branch[]
    setBranches(list)
    setReady(true)
    setCounts(await memberCounts())
  }, [])

  useEffect(() => { void load() }, [load])

  const add = async () => {
    if (!draft.name.trim()) return
    setBusy(true)
    const { error } = await supabase.from('branches').insert({
      name: draft.name.trim(),
      address: draft.address.trim() || null,
      phone: draft.phone.trim() || null,
    })
    setBusy(false)
    if (error) {
      push({ tone: 'bad', title: 'Could not add', message: error.message })
      return
    }
    setDraft(EMPTY_DRAFT)
    push({ tone: 'good', title: 'Branch added' })
    await load()
  }

  const patch = async (id: string, changes: Partial<Branch>) => {
    setBranches(prev => prev.map(b => (b.id === id ? { ...b, ...changes } : b)))
    const { error } = await supabase.from('branches').update(changes).eq('id', id)
    if (error) {
      push({ tone: 'bad', title: 'Not saved', message: error.message })
      await load()
    }
    return !error
  }

  const remove = async (branch: Branch) => {
    // Members and check-ins point at a branch, so a used one can only be closed.
    const { data: deleted, error } = await supabase.from('branches').delete().eq('id', branch.id).select('id')
    if (isStillReferenced(error)) {
      if (await patch(branch.id, { is_active: false })) {
        push({ tone: 'info', title: 'Branch closed', message: 'It has history against it, so the record stays.' })
      }
    } else if (error || !deleted?.length) {
      push({ tone: 'bad', title: 'Not removed', message: error?.message ?? 'You do not have permission to remove branches.' })
    } else {
      push({ tone: 'good', title: 'Branch removed' })
    }
    await load()
  }

  const reopen = async (branch: Branch) => {
    if (await patch(branch.id, { is_active: true })) push({ tone: 'good', title: branch.name + ' reopened' })
  }

  return (
    <div className="max-w-3xl animate-rise">
      <h1 className="text-3xl lg:text-4xl">Branches</h1>
      <p className="mt-2 text-[15px] text-chalk-dim">
        Add as many locations as you run. Memberships are valid at every branch.
      </p>

      {!ready ? (
        <div className="mt-5 space-y-2" aria-busy="true" aria-label="Loading branches">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-sm bg-base-panel" />
          ))}
        </div>
      ) : branches.length === 0 ? (
        <p className="py-16 text-center text-mute">No branches yet. Add your first one below.</p>
      ) : (
        <ul role="list" className="mt-5 flex flex-col gap-2">
          {branches.map(branch => (
            <li key={branch.id} className="rounded-sm bg-base-panel p-4">
              <div className={cn('flex flex-wrap items-start justify-between gap-3', !branch.is_active && 'opacity-50')}>
                <div className="min-w-0 flex-1">
                  <input
                    aria-label="Branch name"
                    defaultValue={branch.name}
                    onBlur={e => e.target.value.trim() && e.target.value !== branch.name && patch(branch.id, { name: e.target.value.trim() })}
                    className="-mx-2 w-[calc(100%+1rem)] rounded-sm bg-transparent px-2 py-1 font-display text-2xl uppercase tracking-tightest outline-none focus:bg-base-raised focus:text-live"
                  />
                  <input
                    aria-label="Branch address"
                    defaultValue={branch.address ?? ''}
                    placeholder="Address"
                    onBlur={e => e.target.value !== (branch.address ?? '') && patch(branch.id, { address: e.target.value.trim() || null })}
                    className="-mx-2 mt-0.5 w-[calc(100%+1rem)] rounded-sm bg-transparent px-2 py-2 text-base text-mute outline-none placeholder:text-mute focus:bg-base-raised focus:text-chalk md:text-sm"
                  />
                </div>
                <div className="text-right">
                  <p className="font-display text-3xl tabular-nums text-live">{counts[branch.id] ?? 0}</p>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-mute">
                    {plural(counts[branch.id] ?? 0, 'member')}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                {branch.is_active ? (
                  <>
                    <Link href={'/admin/branches/' + branch.id + '/code'} className="btn-quiet h-11 px-3.5 text-sm">
                      <QrCode size={16} aria-hidden /> Entrance code
                    </Link>
                    <button
                      onClick={() => setRemoving(branch)}
                      aria-label={'Remove ' + branch.name}
                      className="ml-auto grid h-11 w-11 place-items-center rounded-sm text-mute transition-colors hover:bg-out-tint hover:text-out"
                    >
                      <Trash2 size={17} aria-hidden />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-mute">Closed</span>
                    <button onClick={() => void reopen(branch)} className="btn-quiet ml-auto h-11 px-3.5 text-sm">
                      <RotateCcw size={16} aria-hidden /> Reopen
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        <Accordion title="Add a branch" defaultOpen={ready && branches.length === 0}>
          <div className="grid gap-3 sm:grid-cols-3">
            <input placeholder="Name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className="field" />
            <input placeholder="Address" value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} className="field" />
            <input placeholder="Phone" type="tel" inputMode="tel" value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} className="field" />
          </div>
          <button onClick={add} disabled={busy || !draft.name.trim()} className="btn-primary mt-4 w-full sm:w-auto sm:px-8">
            {busy ? <span className="dots">Adding</span> : <><Plus size={17} aria-hidden /> Add branch</>}
          </button>
        </Accordion>
      </div>

      {removing && (
        <Dialog
          title={'Remove ' + removing.name + '?'}
          body="Members assigned to it stay members. Their check-in history is kept."
          confirmLabel="Remove"
          tone="danger"
          onConfirm={() => remove(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  )
}
