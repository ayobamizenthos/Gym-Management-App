import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/server-supabase'
import { readJson } from '@/lib/server-http'

export const dynamic = 'force-dynamic'

interface Body {
  full_name?: string
  phone?: string
  email?: string
  address?: string
  date_of_birth?: string
  username?: string
  password?: string
  referral?: string
}

/**
 * Public sign-up.
 *
 * Accounts are created already confirmed rather than sending a verification
 * email: a gym member joining at the front desk should be able to train the
 * same minute, and the confirmation round trip only ever loses people. The
 * endpoint grants no privileges - the profile trigger always writes role
 * 'member', so this can never mint staff.
 */
export async function POST(request: Request) {
  const body = await readJson<Body>(request)
  if (!body) return NextResponse.json({ error: 'Malformed request' }, { status: 400 })


  const fullName = body.full_name?.trim()
  const phone = body.phone?.trim()
  const email = body.email?.trim().toLowerCase()
  const address = body.address?.trim() ?? null
  const dateOfBirth = body.date_of_birth?.trim() || null
  const username = body.username?.trim().toLowerCase()
  const password = body.password ?? ''
  const referral = body.referral?.trim().toLowerCase() ?? null

  if (!fullName || fullName.length < 2) {
    return NextResponse.json({ error: 'Enter your full name' }, { status: 400 })
  }
  if (!phone || phone.replace(/\D/g, '').length < 7) {
    return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 })
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  if (!username || !/^[a-z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json({ error: 'Username must be 3-20 letters, numbers or underscore' }, { status: 400 })
  }

  const admin = serviceClient()

  const { data: taken } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()
  if (taken) {
    return NextResponse.json({ error: 'Username already exists' }, { status: 409 })
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone, address, date_of_birth: dateOfBirth, username, referral },
  })

  if (error) {
    const message = /already registered|already been registered/i.test(error.message)
      ? 'An account with that email already exists'
      : error.message
    return NextResponse.json({ error: message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
