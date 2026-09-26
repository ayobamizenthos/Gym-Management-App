/**
 * A truncated or non-JSON body makes request.json() throw, which Next turns
 * into a 500. That reads as a server fault in logs and monitoring when it is
 * really a bad request, so every route parses through here instead.
 */
export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? (body as T) : null
  } catch {
    return null
  }
}

/** The visitor's address as the hosting edge saw it. */
export function clientAddress(request: Request) {
  return (
    request.headers.get('x-nf-client-connection-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}
