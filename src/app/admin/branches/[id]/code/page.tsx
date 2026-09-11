'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Printer, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { Loader } from '@/components/Loader'
import type { Branch } from '@/lib/types'

export default function EntranceCode() {
  const { id } = useParams<{ id: string }>()
  const [branch, setBranch] = useState<Branch | null>(null)
  const [png, setPng] = useState<string | null>(null)

  useEffect(() => {
    void supabase.from('branches').select('*').eq('id', id).maybeSingle()
      .then(({ data }) => setBranch(data as Branch))
  }, [id])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const target = window.location.origin + '/checkin?b=' + id
    void QRCode.toDataURL(target, {
      width: 1200,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: { dark: '#0B0B0C', light: '#FFFFFF' },
    }).then(setPng)
  }, [id])

  if (!branch || !png) return <Loader />

  return (
    <div className="animate-rise">
      <div className="no-print flex items-center justify-between">
        <Link href="/admin/branches" className="flex items-center gap-2 text-sm text-mute hover:text-chalk">
          <ArrowLeft size={16} /> Branches
        </Link>
        <button onClick={() => window.print()} className="btn-primary h-11 px-5 text-sm">
          <Printer size={17} /> Print
        </button>
      </div>

      <p className="no-print mt-6 max-w-lg text-sm text-mute">
        Print this and mount it at the entrance. Members scan it on the way in and see
        their membership status instantly. The front desk hears the result.
      </p>

      {/* The printable sheet. White so it survives any printer. */}
      <div className="print-sheet mx-auto mt-7 w-full max-w-[560px] bg-white p-10 text-center text-black print:mt-0">
        <p className="font-display text-4xl uppercase tracking-tightest">
          Zenthos<span className="text-chalk">Gym</span>
        </p>

        <img src={png} alt="Entrance check-in code" className="mx-auto mt-7 w-full max-w-[380px]" />

        <p className="mt-7 font-display text-5xl uppercase leading-[0.9] tracking-tightest">
          Scan before<br />you train
        </p>
        <p className="mt-4 text-base leading-relaxed">
          Point your phone camera at the code.<br />
          You will see your membership status straight away.
        </p>
      </div>
    </div>
  )
}
