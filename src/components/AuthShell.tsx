import Image from 'next/image'
import { Logo } from '@/components/Logo'

interface Props {
  title: string
  subtitle?: string
  children: React.ReactNode
}

/** Sign in and sign up: the gym in frame at the top, the form rising out of it. */
export function AuthShell({ title, subtitle, children }: Props) {
  return (
    <main className="min-h-dvh bg-base">
      <div className="relative h-[32dvh] min-h-[200px] overflow-hidden">
        <Image src="/img/rack.jpg" alt="" fill priority sizes="100vw" className="object-cover opacity-55 [mask-image:linear-gradient(to_bottom,black_45%,transparent_92%)]" />
        <div aria-hidden className="absolute inset-x-0 -bottom-1 top-0 bg-gradient-to-b from-base/20 via-base/55 to-base to-95%" />
        <div className="absolute inset-x-0 top-0 mx-auto max-w-md px-6 pt-[max(1.75rem,env(safe-area-inset-top))]">
          <Logo height={22} />
        </div>
      </div>
      <div className="relative mx-auto -mt-20 max-w-md animate-rise px-6 pb-12">
        <h1 className="text-[46px]">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-chalk-dim">{subtitle}</p>}
        {children}
      </div>
    </main>
  )
}
