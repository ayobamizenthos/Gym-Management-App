import { RoleGate } from '@/components/RoleGate'
import { DeskChrome } from '@/components/desk/DeskChrome'

export default function DeskLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow={['receptionist', 'admin']}>
      <DeskChrome>{children}</DeskChrome>
    </RoleGate>
  )
}
