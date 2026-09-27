/** Where tapping each kind of alert takes someone. Read by the app and by the push sender. */
const ROUTES: Record<string, (role: string | null) => string> = {
  payment_confirmed: () => '/m/history',
  payment_rejected: () => '/m/history',
  payment_pending: () => '/desk/payments',
  member_joined: () => '/desk/members',
  renewals_due: role => (role === 'member' ? '/m/renew' : '/desk/members'),
  referral_reward: () => '/m/referrals',
  referral_joined: () => '/m/referrals',
  birthday: () => '/m',
}

export const alertRoute = (type: string, role: string | null) => (ROUTES[type] ?? (() => '/m'))(role)
