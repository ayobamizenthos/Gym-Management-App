import { NextResponse } from 'next/server'
import { callerProfile, serviceClient } from '@/lib/server-supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const caller = await callerProfile(request)
  if (!caller || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 })
  }

  const body = (await request.json()) as {
    full_name?: string
    email?: string
    password?: string
    role?: 'receptionist' | 'admin'
    branch_id?: string | null
  }

  const fullName = body.full_name?.trim()
  const email = body.email?.trim().toLowerCase()
  const role = body.role === 'admin' ? 'admin' : 'receptionist'

  if (!fullName || !email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
  }

  const admin = serviceClient()
  const password = body.password?.trim() || 'zg-' + Math.random().toString(36).slice(2, 10)

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { error: roleError } = await admin
    .from('profiles')
    .update({ role, branch_id: body.branch_id ?? null })
    .eq('id', data.user.id)
  if (roleError) return NextResponse.json({ error: roleError.message }, { status: 400 })

  await admin.from('audit_log').insert({
    actor_id: caller.id,
    action: 'create_staff',
    entity: 'profiles',
    entity_id: data.user.id,
    details: { email, role },
  })

  return NextResponse.json({ id: data.user.id, email, password, role })
}
