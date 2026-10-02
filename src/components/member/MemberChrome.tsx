'use client'

import { usePathname } from 'next/navigation'
import { House, Dumbbell, ScanLine, Users, UserRound } from 'lucide-react'
import { BottomNav } from '@/components/BottomNav'
import { useAuth } from '@/stores/auth'
import { AlertBell } from '@/components/AlertBell'
import { WorkoutBar } from '@/components/workouts/WorkoutBar'
import { useWorkoutBackground } from '@/hooks/useWorkoutBackground'
import { useHydrated } from '@/hooks/useHydrated'
import { useWorkout } from '@/stores/workout'
import { cn } from '@/lib/cn'

// Full-screen tasks: no bar, no bell, nothing floating over them.
const FOCUSED = ['/m/workouts/live', '/m/workouts/routines', '/m/workouts/done']
// Scanning fills the screen, and workout pages carry their own top bar.
const NO_BELL = ['/m/scan', '/m/workouts']

const under = (path: string, prefixes: string[]) => prefixes.some(prefix => path === prefix || path.startsWith(prefix + '/'))

export function MemberChrome({ children }: { children: React.ReactNode }) {
  const { role, profile } = useAuth()
  const path = usePathname()
  useWorkoutBackground(profile?.id)
  const hydrated = useHydrated()
  const training = useWorkout(state => state.session !== null) && hydrated

  const focused = under(path, FOCUSED)
  const staffHome =
    role === 'admin'
      ? { href: '/admin', label: 'Dashboard' }
      : role === 'receptionist'
        ? { href: '/desk/overview', label: 'Front desk' }
        : null

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      {/* floats over the page so the photographic headers keep the full bleed */}
      {!focused && !under(path, NO_BELL) && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-30 mx-auto flex max-w-2xl justify-end px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <span className="pointer-events-auto">
            <AlertBell href="/m/alerts" home="/m" />
          </span>
        </div>
      )}

      <main
        className={cn(
          'flex-1 px-5 pt-[var(--member-top)]',
          focused ? 'pb-10' : training ? 'pb-[calc(var(--nav-offset)+7rem)]' : 'pad-nav'
        )}
      >
        {children}
      </main>

      {!focused && (
        <>
          <WorkoutBar />
          <BottomNav
            label="Main"
            swipe={staffHome ? { left: staffHome } : undefined}
            left={[
              { href: '/m', label: 'Home', icon: House },
              { href: '/m/workouts', label: 'Workouts', icon: Dumbbell, section: '/m/workouts' },
            ]}
            action={{ href: '/m/scan', label: 'Check in', icon: ScanLine }}
            right={[
              { href: '/m/referrals', label: 'Invite', icon: Users },
              { href: '/m/account', label: 'Account', icon: UserRound },
            ]}
          />
        </>
      )}
    </div>
  )
}
