import type { Ring, RingAction, RingMember } from './types.js'
import { joinUrl, sameSite } from './url.js'

export interface Locator {
  /** Member id, usually from `?from=`. */
  id?: string | undefined
  /** A page URL on the member's site, usually the Referer header. */
  url?: string | undefined
}

/** Find a member by id first, then by site URL. */
export function findMember(ring: Ring, where: Locator): RingMember | undefined {
  if (where.id) {
    const byId = ring.members.find((m) => m.id === where.id)
    if (byId) return byId
  }
  if (where.url) {
    // Longest registered URL wins so `/blog` beats the bare host.
    return ring.members
      .filter((m) => sameSite(m.url, where.url as string))
      .sort((a, b) => b.url.length - a.url.length)[0]
  }
  return undefined
}

export function indexOfMember(ring: Ring, memberId: string): number {
  return ring.members.findIndex((m) => m.id === memberId)
}

/** Previous and next members, wrapping around the ends of the list. */
export function neighbors(
  ring: Ring,
  memberId: string,
): { prev: RingMember; next: RingMember } | undefined {
  const n = ring.members.length
  const i = indexOfMember(ring, memberId)
  if (i < 0 || n === 0) return undefined
  const prev = ring.members[(i - 1 + n) % n] as RingMember
  const next = ring.members[(i + 1) % n] as RingMember
  return { prev, next }
}

export interface PickOptions {
  /** Where the visitor came from. Needed for prev/next; excluded from random. */
  from?: Locator | undefined
  /** Random source in [0, 1). Defaults to Math.random. */
  rng?: (() => number) | undefined
}

/**
 * Pick the member a navigation action should land on. Returns undefined when
 * the ring is empty or when prev/next is requested from an unknown site.
 */
export function pick(ring: Ring, action: RingAction, options: PickOptions = {}): RingMember | undefined {
  if (ring.members.length === 0) return undefined
  const origin = options.from ? findMember(ring, options.from) : undefined

  if (action === 'random') {
    const pool = origin && ring.members.length > 1 ? ring.members.filter((m) => m.id !== origin.id) : ring.members
    const rng = options.rng ?? Math.random
    const i = Math.min(pool.length - 1, Math.floor(rng() * pool.length))
    return pool[i]
  }

  if (!origin) return undefined
  const around = neighbors(ring, origin.id)
  return around ? around[action] : undefined
}

export interface NavigationUrls {
  prev: string
  next: string
  random: string
  index: string
}

/** The three links a member puts on their site, plus the ring's home. */
export function navigationUrls(ring: Ring, memberId?: string): NavigationUrls {
  const q = memberId ? `?from=${encodeURIComponent(memberId)}` : ''
  return {
    prev: joinUrl(ring.url, `prev${q}`),
    next: joinUrl(ring.url, `next${q}`),
    random: joinUrl(ring.url, `random${q}`),
    index: ring.url,
  }
}

/** Shape served at `<ring.url>/ring.json`. Members only expose public fields. */
export interface RingFeed {
  kinring: 1
  id: string
  name: string
  url: string
  description?: string
  joinUrl: string
  count: number
  members: RingMember[]
}

export function ringFeed(ring: Ring): RingFeed {
  const feed: RingFeed = {
    kinring: 1,
    id: ring.id,
    name: ring.name,
    url: ring.url,
    joinUrl: ring.joinUrl ?? ring.url,
    count: ring.members.length,
    members: ring.members.map(publicMember),
  }
  if (ring.description) feed.description = ring.description
  return feed
}

function publicMember(m: RingMember): RingMember {
  const out: RingMember = { id: m.id, name: m.name, url: m.url }
  if (m.description) out.description = m.description
  if (m.feed) out.feed = m.feed
  if (m.button) out.button = { ...m.button }
  return out
}

/** OPML of every member feed, for people who want to subscribe to the whole ring. */
export function ringOpml(ring: Ring): string {
  const outlines = ring.members
    .filter((m) => m.feed)
    .map(
      (m) =>
        `    <outline type="rss" text="${escapeXml(m.name)}" title="${escapeXml(m.name)}" xmlUrl="${escapeXml(
          m.feed as string,
        )}" htmlUrl="${escapeXml(m.url)}" />`,
    )
    .join('\n')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    `  <head><title>${escapeXml(ring.name)}</title></head>`,
    '  <body>',
    outlines,
    '  </body>',
    '</opml>',
    '',
  ].join('\n')
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
