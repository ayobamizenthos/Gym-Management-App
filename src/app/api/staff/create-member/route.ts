import { NextResponse } from 'next/server'
import { callerProfile, serviceClient } from '@/lib/server-supabase'
import { PLACEHOLDER_EMAIL_DOMAIN } from '@/lib/members'
import { temporaryPassword } from '@/lib/server-credentials'
import { readJson } from '@/lib/server-http'

export const dynamic = 'force-dynamic'

interface Body {
  full_name?: string
  phone?: string
  email?: string
  username?: string
  password?: string
  branch_id?: string | null
}

export async function POST(request: Request) {
  const caller = await callerProfile(request)
  if (!caller || (caller.role !== 'receptionist' && caller.role !== 'admin')) {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 })
  }

  const body = await readJson<Body>(request)
  if (!body) return NextResponse.json({ error: 'Malformed request' }, { status: 400 })

  const fullName = body.full_name?.trim()
  const phone = body.phone?.trim()
  const email = body.email?.trim().toLowerCase()
  const username = body.username?.trim().toLowerCase()

  if (!fullName || !phone) {
    return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
  }
  if (username && !/^[a-z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json({ error: 'Username must be 3-20 letters, numbers or underscore' }, { status: 400 })
  }

  const admin = serviceClient()

  // Members registered from a paper form often have no email. Mint a stable
  // placeholder so the account still exists and can be claimed later.
  const login = email || `m${Date.now().toString(36)}${PLACEHOLDER_EMAIL_DOMAIN}`
  const password = body.password?.trim() || temporaryPassword()

  const { data, error } = await admin.auth.admin.createUser({
    email: login,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone, username: username ?? null },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (body.branch_id) {
    await admin.from('profiles').update({ branch_id: body.branch_id }).eq('id', data.user.id)
  }
  await admin.from('audit_log').insert({
    actor_id: caller.id,
    action: 'create_member',
    entity: 'profiles',
    entity_id: data.user.id,
    details: { full_name: fullName, by_role: caller.role },
  })

  return NextResponse.json({ id: data.user.id, email: login, password })
}
