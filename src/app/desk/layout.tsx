import { RoleGate } from '@/components/RoleGate'
import { WorkspaceChrome } from '@/components/workspace/WorkspaceChrome'

export default function DeskLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow={['receptionist', 'admin']}>
      <WorkspaceChrome workspace="desk">{children}</WorkspaceChrome>
    </RoleGate>
  )
}
