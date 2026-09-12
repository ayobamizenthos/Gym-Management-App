export type Role = 'member' | 'receptionist' | 'admin'
export type PayMethod = 'paystack' | 'transfer' | 'cash'
export type PayStatus = 'pending' | 'confirmed' | 'rejected'
export type CheckInKind = 'valid' | 'expired' | 'duplicate' | 'no_membership'

export interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  role: Role
  branch_id: string | null
  username: string | null
  referred_by: string | null
  photo_url: string | null
  address: string | null
  email: string | null
  date_of_birth: string | null
  emergency_contact: string | null
  registration_paid: boolean
  notifications_enabled: boolean
  expires_at: string | null
  pending_days: number
  created_at: string
}

export interface Plan {
  id: string
  name: string
  price: string
  duration_days: number
  counts_for_referral: boolean
  is_addon: boolean
  requires_registration: boolean
  is_active: boolean
  sort_order: number
}

export interface Branch {
  id: string
  name: string
  address: string | null
  phone: string | null
  is_active: boolean
}

export interface Payment {
  id: string
  user_id: string
  plan_id: string | null
  branch_id: string | null
  amount: string
  method: PayMethod
  status: PayStatus
  reference: string | null
  proof_url: string | null
  includes_registration: boolean
  confirmed_at: string | null
  created_at: string
}

export interface CheckInRow {
  id: string
  user_id: string
  branch_id: string | null
  kind: CheckInKind
  created_at: string
}

export interface CheckInResult {
  kind: CheckInKind
  full_name: string | null
  username: string | null
  photo_url: string | null
  expires_at: string | null
  days_left: number | null
  just_started?: boolean
  is_active: boolean
  last_check_in: string | null
}

export interface Settings {
  id: boolean
  gym_name: string
  registration_fee: string
  referral_target: number
  referral_reward_days: number
  expiry_notice_days: number
  checkin_window_hours: number
}
