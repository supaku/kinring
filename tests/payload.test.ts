import { describe, expect, it } from 'vitest'
import { createRingMembersCollection, loadRingFromPayload } from '../src/payload/index.js'

function fakePayload(docs: Record<string, unknown>[]) {
  const calls: unknown[] = []
  return {
    calls,
    find: async (args: unknown) => {
      calls.push(args)
      return { docs }
    },
  }
}

describe('createRingMembersCollection', () => {
  it('builds a collection with the expected fields', () => {
    const c = createRingMembersCollection()
    expect(c.slug).toBe('ring-members')
    const names = c.fields.map((f) => ('name' in f ? f.name : undefined))
    expect(names).toEqual(['name', 'slug', 'url', 'description', 'feed', 'button', 'button2x', 'active', 'order'])
  })
  it('accepts slug, media, extra fields and overrides', () => {
    const c = createRingMembersCollection({
      slug: 'friends',
      mediaSlug: 'uploads',
      extraFields: [{ name: 'featured', type: 'checkbox' }],
      overrides: { admin: { useAsTitle: 'url' } },
    })
    expect(c.slug).toBe('friends')
    const button = c.fields.find((f) => 'name' in f && f.name === 'button')
    expect(button && 'relationTo' in button ? button.relationTo : undefined).toBe('uploads')
    expect(c.fields.some((f) => 'name' in f && f.name === 'featured')).toBe(true)
    expect(c.admin?.useAsTitle).toBe('url')
  })
  it('validates slugs and urls', () => {
    const c = createRingMembersCollection()
    const slug = c.fields.find((f) => 'name' in f && f.name === 'slug') as { validate: (v: unknown) => unknown }
    const url = c.fields.find((f) => 'name' in f && f.name === 'url') as { validate: (v: unknown) => unknown }
    expect(slug.validate('good-slug')).toBe(true)
    expect(slug.validate('Bad Slug')).toMatch(/lowercase/)
    expect(url.validate('https://ok.example')).toBe(true)
    expect(url.validate('nope')).toMatch(/http/)
  })
})

describe('loadRingFromPayload', () => {
  it('maps documents to members and resolves relative upload urls', async () => {
    const payload = fakePayload([
      {
        slug: 'alpha',
        name: 'Alpha',
        url: 'https://alpha.example',
        feed: 'https://alpha.example/rss',
        button: { url: '/api/media/file/alpha.png', alt: 'Alpha button' },
        button2x: { url: 'https://cdn.example/alpha@2x.png' },
      },
      { slug: 'beta', name: 'Beta', url: 'https://beta.example', button: 7 },
    ])
    const ring = await loadRingFromPayload(payload as never, {
      ring: { id: 'r', name: 'Ring', url: 'https://host.example/ring' },
    })
    expect(ring.members).toEqual([
      {
        id: 'alpha',
        name: 'Alpha',
        url: 'https://alpha.example',
        feed: 'https://alpha.example/rss',
        button: { src: 'https://host.example/api/media/file/alpha.png', src2x: 'https://cdn.example/alpha@2x.png', alt: 'Alpha button' },
      },
      { id: 'beta', name: 'Beta', url: 'https://beta.example' },
    ])
    expect(payload.calls[0]).toMatchObject({ collection: 'ring-members', where: { active: { equals: true } } })
  })

  it('merges extra where clauses and custom collection', async () => {
    const payload = fakePayload([])
    await loadRingFromPayload(payload as never, {
      collection: 'friends',
      where: { inRing: { equals: true } },
      ring: { id: 'r', name: 'Ring', url: 'https://host.example/ring' },
    })
    expect(payload.calls[0]).toMatchObject({
      collection: 'friends',
      where: { and: [{ active: { equals: true } }, { inRing: { equals: true } }] },
    })
  })

  it('throws with every issue when the data is bad', async () => {
    const payload = fakePayload([
      { slug: 'dup', name: 'A', url: 'https://a.example' },
      { slug: 'dup', name: 'B', url: 'bad' },
    ])
    await expect(
      loadRingFromPayload(payload as never, { ring: { id: 'r', name: 'Ring', url: 'https://host.example/ring' } }),
    ).rejects.toThrow(/members\[1\]\.url: must be an absolute.*members\[1\]\.id: duplicate member id "dup"/)
  })
})
