'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, QrCode } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useToasts } from '@/stores/toast'
import { cn } from '@/lib/cn'
import type { Branch } from '@/lib/types'

export default function AdminBranches() {
  const push = useToasts(s => s.push)
  const [rows, setRows] = useState<Branch[]>([])
  const [draft, setDraft] = useState({ name: '', address: '', phone: '' })
  const [counts, setCounts] = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    const { data } = await supabase.from('branches').select('*').order('name')
    const list = (data ?? []) as Branch[]
    setRows(list)
    const tallies: Record<string, number> = {}
    await Promise.all(
      list.map(async b => {
        const { count } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('branch_id', b.id)
          .eq('role', 'member')
        tallies[b.id] = count ?? 0
      })
    )
    setCounts(tallies)
  }, [])

  useEffect(() => { void load() }, [load])

  const add = async () => {
    if (!draft.name.trim()) return
    const { error } = await supabase.from('branches').insert({
      name: draft.name.trim(),
      address: draft.address.trim() || null,
      phone: draft.phone.trim() || null,
    })
    if (error) push({ tone: 'bad', title: 'Could not add', message: error.message })
    else { setDraft({ name: '', address: '', phone: '' }); await load() }
  }

  const patch = async (id: string, changes: Partial<Branch>) => {
    setRows(prev => prev.map(b => (b.id === id ? { ...b, ...changes } as Branch : b)))
    await supabase.from('branches').update(changes).eq('id', id)
  }

  const remove = async (b: Branch) => {
    if (!window.confirm('Remove ' + b.name + '?')) return
    const { error } = await supabase.from('branches').delete().eq('id', b.id)
    if (error) await patch(b.id, { is_active: false })
    await load()
  }

  return (
    <div className="max-w-3xl animate-rise">
      <h1 className="text-4xl lg:text-5xl">Branches</h1>
      <p className="mt-2 text-sm text-mute">
        Add as many locations as you run. Memberships are valid at every branch.
      </p>

      <div className="rule mt-6" />

      <ul className="mt-5 flex flex-col gap-2">
        {rows.map(b => (
          <li key={b.id} className={cn('bg-surface-raised p-4', !b.is_active && 'opacity-50')}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <input
                  defaultValue={b.name}
                  onBlur={e => e.target.value !== b.name && patch(b.id, { name: e.target.value })}
                  className="w-full bg-transparent font-display text-2xl uppercase tracking-tightest outline-none focus:text-good"
                />
                <input
                  defaultValue={b.address ?? ''}
                  placeholder="Address"
                  onBlur={e => patch(b.id, { address: e.target.value })}
                  className="mt-1 w-full bg-transparent text-sm text-mute outline-none focus:text-ink"
                />
              </div>
              <div className="text-right">
                <p className="font-display text-3xl tabular-nums text-good">{counts[b.id] ?? 0}</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-mute">members</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Link href={'/admin/branches/' + b.id + '/code'} className="btn-quiet h-9 px-3 text-xs">
                <QrCode size={15} /> Entrance code
              </Link>
              <button onClick={() => remove(b)} className="ml-auto text-mute hover:text-alert" aria-label="Remove">
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="rule mt-8" />

      <section className="mt-6">
        <h2 className="text-2xl">Add a branch</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input placeholder="Name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className="field" />
          <input placeholder="Address" value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} className="field" />
          <input placeholder="Phone" value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} className="field" />
        </div>
        <button onClick={add} className="btn-primary mt-3"><Plus size={17} /> Add branch</button>
      </section>
    </div>
  )
}
