'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Printer } from 'lucide-react'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { Loader } from '@/components/Loader'
import { BackLink } from '@/components/BackLink'
import type { Branch } from '@/lib/types'

const QR_SIZE = 1200
const QR_INK = '#0B0B0C'
const QR_PAPER = '#FFFFFF'

interface Props {
  branchId: string
  back: { fallback: string; label: string }
}

/** The printable poster for one branch entrance. Members scan it on the way in. */
export function EntranceCode({ branchId, back }: Props) {
  const [branch, setBranch] = useState<Branch | 'missing' | null>(null)
  const [png, setPng] = useState<string | null>(null)

  useEffect(() => {
    setBranch(null)
    void supabase.from('branches').select('*').eq('id', branchId).maybeSingle()
      .then(({ data }) => setBranch(data ? (data as Branch) : 'missing'))
  }, [branchId])

  useEffect(() => {
    const target = window.location.origin + '/checkin?b=' + branchId
    void QRCode.toDataURL(target, {
      width: QR_SIZE,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: { dark: QR_INK, light: QR_PAPER },
    }).then(setPng)
  }, [branchId])

  if (branch === 'missing') {
    return (
      <div className="animate-rise">
        <BackLink fallback={back.fallback} label={back.label} />
        <p className="py-20 text-center text-[15px] text-mute">This branch no longer exists.</p>
      </div>
    )
  }

  if (!branch || !png) return <Loader />

  return (
    <div className="animate-rise">
      <div className="no-print flex items-center justify-between gap-3">
        <BackLink fallback={back.fallback} label={back.label} />
        <button onClick={() => window.print()} className="btn-primary h-11 px-5 text-sm">
          <Printer size={17} aria-hidden /> Print
        </button>
      </div>

      <p className="no-print mt-5 font-display text-2xl uppercase tracking-tightest">{branch.name}</p>

      {/* A4 in proportion, and white so it survives any printer */}
      <div className="print-sheet mx-auto mt-5 flex aspect-[210/297] w-full max-w-[560px] flex-col items-center justify-center bg-white px-[8%] text-center text-black">
        {/* the mark sits in the middle of the code; high error correction keeps it scannable */}
        <div className="print-qr relative w-[84%]">
          <Image src={png} alt={'Entrance check-in code for ' + branch.name} width={QR_SIZE} height={QR_SIZE} unoptimized className="block h-auto w-full" />
          <span className="absolute left-1/2 top-1/2 grid w-[22%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[22%] bg-white p-[2.5%]">
            {/* eslint-disable-next-line @next/next/no-img-element -- a vector that must print sharp */}
            <img src="/icon.svg" alt="Zenthos" className="block aspect-square w-full" />
          </span>
        </div>

        <p className="mt-[8%] whitespace-nowrap font-display text-[clamp(2rem,9vw,3.4rem)] uppercase leading-none tracking-tightest">
          Scan for access
        </p>
      </div>
    </div>
  )
}
