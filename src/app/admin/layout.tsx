import { RoleGate } from '@/components/RoleGate'
import { WorkspaceChrome } from '@/components/workspace/WorkspaceChrome'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow={['admin']}>
      <WorkspaceChrome workspace="admin">{children}</WorkspaceChrome>
    </RoleGate>
  )
}
