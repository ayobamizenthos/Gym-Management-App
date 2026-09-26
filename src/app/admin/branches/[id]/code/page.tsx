'use client'

import { useParams } from 'next/navigation'
import { EntranceCode } from '@/components/EntranceCode'

export default function AdminEntranceCode() {
  const { id } = useParams<{ id: string }>()
  return <EntranceCode branchId={id} back={{ fallback: '/admin/branches', label: 'Branches' }} />
}
