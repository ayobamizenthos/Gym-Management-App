'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, LogOut } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/stores/auth'
import { NotificationToggle } from '@/components/NotificationToggle'
import { Avatar } from '@/components/Avatar'

export interface MoreLink {
  href: string
  label: string
  hint: string
  icon: LucideIcon
}

/** The overflow half of the bottom bar: everything the four tabs could not hold,
 *  plus the two things people look for last - preferences and the way out. */
export function MoreMenu({ title, groups }: { title: string; groups: { heading?: string; links: MoreLink[] }[] }) {
  const { profile, signOut } = useAuth()
  const router = useRouter()

  return (
    <div className="mx-auto max-w-xl animate-rise">
      <h1 className="text-4xl">{title}</h1>

      <div className="mt-6 flex items-center gap-3.5 rounded-lg bg-base-panel px-4 py-3.5">
        <Avatar path={profile?.photo_url} name={profile?.full_name} size={44} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{profile?.full_name ?? 'Signed in'}</p>
          <p className="truncate text-sm text-mute">
            {profile?.role === 'admin' ? 'Administrator' : profile?.role === 'receptionist' ? 'Front desk' : 'Member'}
          </p>
        </div>
      </div>

      {groups.map((group, index) => (
        <section key={group.heading ?? index} className="mt-6">
          {group.heading && (
            <h2 className="font-body text-[11px] font-semibold uppercase tracking-[0.22em] text-mute">{group.heading}</h2>
          )}
          <ul role="list" className="mt-3 overflow-hidden rounded-lg bg-base-panel">
            {group.links.map(link => (
              <li key={link.href} className="border-b border-edge-soft last:border-0">
                <Link href={link.href} className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-base-raised">
                  <link.icon size={19} className="shrink-0 text-mute" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{link.label}</span>
                    <span className="block truncate text-sm text-mute">{link.hint}</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-mute" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="mt-6">
        <h2 className="font-body text-[11px] font-semibold uppercase tracking-[0.22em] text-mute">Preferences</h2>
        <div className="mt-3 rounded-lg bg-base-panel px-4">
          <NotificationToggle />
        </div>
      </section>

      <button
        onClick={async () => {
          await signOut()
          router.replace('/login')
        }}
        className="mt-8 flex w-full items-center justify-center gap-2 py-3 text-[15px] font-semibold text-out"
      >
        <LogOut size={17} aria-hidden /> Sign out
      </button>
    </div>
  )
}
