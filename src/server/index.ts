import { pick, ringFeed, ringOpml } from '../core/ring.js'
import { isRingAction, type Ring } from '../core/types.js'
import { EMBED_JS } from '../embed/script.js'

export interface RingHandlerOptions {
  /** Load the ring. Called once per request so membership edits show up immediately. */
  loadRing: () => Promise<Ring> | Ring
  /**
   * Path prefix the handler is mounted at, e.g. `/ring`. Used to work out which
   * action a request is for. Defaults to the pathname of `ring.url`.
   */
  basePath?: string | undefined
  /** Cache-Control for ring.json and embed.js. Default: 5 minutes, shared. */
  cacheControl?: string | undefined
  /** Random source, for tests. */
  rng?: (() => number) | undefined
}

export type RingHandler = (request: Request) => Promise<Response>

/**
 * A fetch-style handler for everything a ring serves under its base path:
 *
 *   GET <base>/prev?from=<id>    302 to the previous member
 *   GET <base>/next?from=<id>    302 to the next member
 *   GET <base>/random            302 to a random member (never the referrer)
 *   GET <base>/ring.json         the membership feed
 *   GET <base>/members.opml      every member feed as OPML
 *   GET <base>/embed.js          the banner script
 *
 * When `?from=` is missing, the Referer header is used to find the member.
 * Unknown origins go to the ring's home page instead of 404ing: a broken
 * banner should still lead somewhere useful.
 */
export function createRingHandler(options: RingHandlerOptions): RingHandler {
  const cacheControl = options.cacheControl ?? 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600'

  return async function handle(request: Request): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } })
    }
    const ring = await options.loadRing()
    const url = new URL(request.url)
    const base = normalizeBase(options.basePath ?? safePathname(ring.url))
    const action = actionFor(url.pathname, base)

    switch (action) {
      case 'ring.json':
        return json(ringFeed(ring), cacheControl)
      case 'members.opml':
        return new Response(ringOpml(ring), {
          headers: { 'content-type': 'text/x-opml+xml; charset=utf-8', 'cache-control': cacheControl },
        })
      case 'embed.js':
        return new Response(EMBED_JS, {
          headers: {
            'content-type': 'text/javascript; charset=utf-8',
            'cache-control': cacheControl,
            'access-control-allow-origin': '*',
          },
        })
      case 'prev':
      case 'next':
      case 'random': {
        const from = url.searchParams.get('from') ?? undefined
        const referer = request.headers.get('referer') ?? undefined
        const target = pick(ring, action, { from: { id: from, url: referer }, rng: options.rng })
        return redirect(target?.url ?? ring.url)
      }
      default:
        return new Response('Not Found', { status: 404 })
    }
  }
}

function actionFor(pathname: string, base: string): string | undefined {
  const path = pathname.replace(/\/+$/, '')
  if (!path.startsWith(base)) return undefined
  const rest = path.slice(base.length).replace(/^\/+/, '')
  if (rest === 'ring.json' || rest === 'members.opml' || rest === 'embed.js') return rest
  if (isRingAction(rest)) return rest
  return undefined
}

function normalizeBase(base: string): string {
  const trimmed = base.replace(/\/+$/, '')
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function safePathname(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return '/'
  }
}

function json(body: unknown, cacheControl: string): Response {
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl,
      'access-control-allow-origin': '*',
    },
  })
}

function redirect(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { location, 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  })
}
