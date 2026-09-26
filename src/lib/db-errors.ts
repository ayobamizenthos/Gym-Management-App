const FOREIGN_KEY_VIOLATION = '23503'

/** True when a delete failed only because other rows still point at the record. */
export const isStillReferenced = (error: { code?: string } | null) => error?.code === FOREIGN_KEY_VIOLATION
