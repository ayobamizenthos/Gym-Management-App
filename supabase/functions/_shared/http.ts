/** A JSON reply with a status. */
export const json = (body: unknown, init: { status?: number } = {}) =>
  new Response(JSON.stringify(body), { status: init.status ?? 200, headers: { 'Content-Type': 'application/json' } })

/** A truncated or non-JSON body is a bad request, not a server fault. */
export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? (body as T) : null
  } catch {
    return null
  }
}

/** The visitor's address as the hosting edge forwarded it. */
export const clientAddress = (request: Request) =>
  request.headers.get('x-nf-client-connection-ip') ??
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
  'unknown'
