'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Printer } from 'lucide-react'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { Loader } from '@/components/Loader'
import { BackLink } from '@/components/BackLink'
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
        <BackLink fallback="/admin/branches" label="Branches" />
        <button onClick={() => window.print()} className="btn-primary h-11 px-5 text-sm">
          <Printer size={17} aria-hidden /> Print
        </button>
      </div>

      <p className="no-print mt-6 max-w-lg text-[15px] text-chalk-dim">
        Print this and mount it at the entrance. Members scan it on the way in and see
        their membership status instantly. The front desk hears the result.
      </p>

      {/* The printable sheet: white so it survives any printer, and its own greys
          so the poster keeps a hierarchy instead of printing as one flat block. */}
      <div className="print-sheet mx-auto mt-7 w-full max-w-[560px] rounded-lg bg-white p-10 text-center print:mt-0">
        <p className="font-display text-4xl uppercase tracking-tightest text-[#0B0B0C]">
          Zenthos<span className="text-[#35D07F]">Gym</span>
        </p>

        <div className="mx-auto mt-7 w-full max-w-[380px] rounded-lg border border-[#E4E4E1] p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={png} alt="Entrance check-in code" className="w-full" />
        </div>

        <p className="mt-7 font-display text-5xl uppercase leading-[0.9] tracking-tightest text-[#0B0B0C]">
          Scan before<br />you train
        </p>
        <p className="mt-4 text-base leading-relaxed text-[#6B6B73]">
          Point your phone camera at the code.<br />
          You will see your membership status straight away.
        </p>

        <p className="mt-8 border-t border-[#E4E4E1] pt-4 text-xs font-semibold uppercase tracking-[0.3em] text-[#9A9AA2]">
          Members only
        </p>
      </div>
    </div>
  )
}
