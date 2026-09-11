import { RoleGate } from '@/components/RoleGate'
import { MemberChrome } from '@/components/member/MemberChrome'

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow={['member', 'receptionist', 'admin']}>
      <MemberChrome>{children}</MemberChrome>
    </RoleGate>
  )
}
