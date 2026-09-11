import { RoleGate } from '@/components/RoleGate'
import { AdminChrome } from '@/components/admin/AdminChrome'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow={['admin']}>
      <AdminChrome>{children}</AdminChrome>
    </RoleGate>
  )
}
