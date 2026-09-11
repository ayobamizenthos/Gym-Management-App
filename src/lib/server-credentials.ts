import { randomInt } from 'node:crypto'

// Ambiguous glyphs are left out so a password read aloud across the front desk
// cannot be mistyped: no O/0, no I/l/1.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

/** Cryptographically random, spoken-aloud friendly. Server only. */
export function temporaryPassword(length = 10) {
  let out = ''
  for (let i = 0; i < length; i += 1) out += ALPHABET[randomInt(ALPHABET.length)]
  return out
}
