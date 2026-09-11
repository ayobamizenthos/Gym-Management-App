/**
 * Members registered from a paper form have no address to give, so the desk
 * mints a login on this domain. Nothing may be sent to it.
 */
export const PLACEHOLDER_EMAIL_DOMAIN = '@members.zenthosgym.local'

export const isReachableEmail = (email: string | null | undefined): email is string =>
  !!email && !email.endsWith(PLACEHOLDER_EMAIL_DOMAIN)
