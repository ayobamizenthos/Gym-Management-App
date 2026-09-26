import type { Role } from './types'

/** Where each role lands after authentication. Staff open on their dashboard;
 *  the member side is one swipe of the bottom bar away. */
export const homeFor = (role: Role | null | undefined) =>
  role === 'admin' ? '/admin' : role === 'receptionist' ? '/desk/overview' : '/m'
