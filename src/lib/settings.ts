import type { Settings } from './types'

export const FALLBACK_GYM_NAME = 'Gym'

// Column defaults from the first migration, shown until the row arrives. The name
// stays neutral so an unbranded screen never shows another gym's name.
export const SETTINGS_DEFAULTS: Settings = {
  id: true,
  gym_name: FALLBACK_GYM_NAME,
  registration_fee: '5000',
  referral_target: 3,
  referral_reward_days: 7,
  expiry_notice_days: 5,
  checkin_window_hours: 24,
}

/** Splits the name so the wordmark can accent its last word. */
export function wordmarkParts(gymName: string): { lead: string; accent: string } {
  const cut = gymName.lastIndexOf(' ')
  return cut > 0
    ? { lead: gymName.slice(0, cut + 1), accent: gymName.slice(cut + 1) }
    : { lead: gymName, accent: '' }
}

export const initialsOf = (gymName: string) =>
  gymName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .join('')
