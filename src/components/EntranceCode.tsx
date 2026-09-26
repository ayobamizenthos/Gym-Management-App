'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Printer } from 'lucide-react'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { Loader } from '@/components/Loader'
import { BackLink } from '@/components/BackLink'
import { Wordmark } from '@/components/Wordmark'
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
        <p className="font-display text-[clamp(1.75rem,8vw,2.75rem)] uppercase leading-none tracking-tightest">
          <Wordmark />
        </p>

        <Image
          src={png}
          alt={'Entrance check-in code for ' + branch.name}
          width={QR_SIZE}
          height={QR_SIZE}
          unoptimized
          className="mt-[7%] h-auto w-[78%]"
        />

        <p className="mt-[7%] font-display text-[clamp(2rem,10vw,3.25rem)] uppercase leading-[0.9] tracking-tightest">
          Scan before<br />you train
        </p>
      </div>
    </div>
  )
}
