import type { CheckInKind } from './types'

/** How the desk names each scan outcome. */
export const CHECK_IN_LABEL: Record<CheckInKind, string> = {
  valid: 'Active',
  expired: 'Expired',
  duplicate: 'Repeat scan',
  no_membership: 'No plan',
}
