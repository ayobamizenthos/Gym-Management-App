import type { Role } from './types'

/** Where each role lands after authentication. */
export const homeFor = (role: Role | null | undefined) =>
  role === 'admin' ? '/admin' : role === 'receptionist' ? '/desk' : '/m'
