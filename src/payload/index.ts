import type { CollectionConfig, Field, Payload, Where } from 'payload'
import type { Ring, RingMember } from '../core/types.js'
import { validateRing } from '../core/validate.js'

export interface RingMembersCollectionOptions {
  /** Collection slug. Default `ring-members`. */
  slug?: string | undefined
  /** Upload collection used for buttons. Default `media`. */
  mediaSlug?: string | undefined
  /** Extra fields appended after the standard ones. */
  extraFields?: Field[] | undefined
  /** Anything here is merged over the generated config last. */
  overrides?: Partial<CollectionConfig> | undefined
}

/**
 * A Payload collection for ring members. One document per site. Order in the
 * ring is the `order` field, then creation date. Buttons are uploads so the
 * admin panel shows a thumbnail and the ring serves them from your storage.
 */
export function createRingMembersCollection(options: RingMembersCollectionOptions = {}): CollectionConfig {
  const slug = options.slug ?? 'ring-members'
  const mediaSlug = options.mediaSlug ?? 'media'

  const fields: Field[] = [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Lowercase letters, numbers, and hyphens. Appears in the navigation links.',
      },
      validate: (value: unknown) =>
        typeof value === 'string' && /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(value)
          ? true
          : 'Use lowercase letters, numbers, and hyphens.',
    },
    {
      name: 'url',
      type: 'text',
      required: true,
      admin: { description: 'Absolute URL of the site, e.g. https://example.com' },
      validate: (value: unknown) => (isHttpUrl(value) ? true : 'Must be an absolute http(s) URL.'),
    },
    {
      name: 'description',
      type: 'text',
    },
    {
      name: 'feed',
      type: 'text',
      admin: { description: 'RSS or Atom feed URL (optional).' },
      validate: (value: unknown) => (value == null || value === '' || isHttpUrl(value) ? true : 'Must be an absolute http(s) URL.'),
    },
    {
      name: 'button',
      type: 'upload',
      relationTo: mediaSlug,
      admin: { description: '88x31 button. GIF, PNG, WebP, or SVG.' },
    },
    {
      name: 'button2x',
      type: 'upload',
      relationTo: mediaSlug,
      admin: { description: '176x62 version for high density screens (optional).' },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar', description: 'Inactive members are kept but skipped by the ring.' },
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
      admin: { position: 'sidebar', description: 'Lower numbers come first.' },
    },
    ...(options.extraFields ?? []),
  ]

  const base: CollectionConfig = {
    slug,
    admin: {
      useAsTitle: 'name',
      defaultColumns: ['name', 'url', 'active', 'order'],
      group: 'Webring',
    },
    access: {
      read: () => true,
    },
    defaultSort: 'order',
    fields,
  }

  return { ...base, ...options.overrides, fields: options.overrides?.fields ?? fields }
}

export interface LoadRingOptions {
  /** Collection slug. Default `ring-members`. */
  collection?: string | undefined
  /** Ring metadata. Members come from the collection. */
  ring: Pick<Ring, 'id' | 'name' | 'url'> & Partial<Pick<Ring, 'description' | 'joinUrl'>>
  /** Extra query constraints, merged with `active = true`. */
  where?: Where | undefined
  /**
   * Turn an upload document into an absolute URL. Default uses `doc.url`
   * and prefixes `baseUrl` when it is relative.
   */
  resolveUrl?: ((doc: UploadLike) => string | undefined) | undefined
  /** Origin to prefix relative upload URLs with. Defaults to the origin of `ring.url`. */
  baseUrl?: string | undefined
}

export interface UploadLike {
  url?: string | null
  filename?: string | null
  alt?: string | null
  width?: number | null
  height?: number | null
}

/**
 * Read active members from Payload and build a validated ring. Throws when
 * the resulting ring is invalid (duplicate slugs, bad URLs), with every issue
 * listed, so a bad admin edit fails loudly in logs rather than quietly
 * breaking navigation.
 */
export async function loadRingFromPayload(payload: Payload, options: LoadRingOptions): Promise<Ring> {
  const collection = options.collection ?? 'ring-members'
  const baseUrl = options.baseUrl ?? originOf(options.ring.url)
  const resolveUrl = options.resolveUrl ?? ((doc: UploadLike) => absolutize(doc.url, baseUrl))

  const where: Where = options.where
    ? { and: [{ active: { equals: true } }, options.where] }
    : { active: { equals: true } }

  const result = await payload.find({
    collection: collection as never,
    where,
    sort: ['order', 'createdAt'],
    limit: 0,
    pagination: false,
    depth: 1,
    overrideAccess: true,
  })

  const members: RingMember[] = []
  for (const doc of result.docs as Record<string, unknown>[]) {
    const member: RingMember = {
      id: String(doc.slug ?? ''),
      name: String(doc.name ?? ''),
      url: String(doc.url ?? ''),
    }
    if (typeof doc.description === 'string' && doc.description) member.description = doc.description
    if (typeof doc.feed === 'string' && doc.feed) member.feed = doc.feed
    const button = isUpload(doc.button) ? resolveUrl(doc.button) : undefined
    if (button) {
      member.button = { src: button }
      const button2x = isUpload(doc.button2x) ? resolveUrl(doc.button2x) : undefined
      if (button2x) member.button.src2x = button2x
      const alt = isUpload(doc.button) && doc.button.alt ? doc.button.alt : member.name
      member.button.alt = alt
    }
    members.push(member)
  }

  const candidate: Ring = {
    id: options.ring.id,
    name: options.ring.name,
    url: options.ring.url,
    members,
  }
  if (options.ring.description) candidate.description = options.ring.description
  if (options.ring.joinUrl) candidate.joinUrl = options.ring.joinUrl

  const { ring, issues } = validateRing(candidate)
  if (!ring) {
    const detail = issues.map((i) => `${i.path}: ${i.message}`).join('; ')
    throw new Error(`kinring: ring "${options.ring.id}" is invalid: ${detail}`)
  }
  return ring
}

function isUpload(v: unknown): v is UploadLike {
  return typeof v === 'object' && v !== null && 'url' in v
}

function isHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function originOf(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

function absolutize(url: string | null | undefined, baseUrl: string): string | undefined {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url)) return url
  if (!baseUrl) return undefined
  return `${baseUrl.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`
}
