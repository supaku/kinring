import { describe, expect, it } from 'vitest'
import {
  embedSnippet,
  findMember,
  navigationUrls,
  neighbors,
  pick,
  plainSnippet,
  ringFeed,
  ringOpml,
  sameSite,
  siteKey,
  validateRing,
} from '../src/index.js'
import { ring } from './fixtures.js'

describe('siteKey / sameSite', () => {
  it('ignores scheme, www, and trailing slash', () => {
    expect(siteKey('https://www.Beta.example/')).toBe('beta.example')
    expect(siteKey('http://beta.example')).toBe('beta.example')
    expect(siteKey('beta.example')).toBe('beta.example')
  })
  it('keeps the path', () => {
    expect(siteKey('https://gamma.example/blog/')).toBe('gamma.example/blog')
  })
  it('rejects non-http', () => {
    expect(siteKey('mailto:a@b.c')).toBeUndefined()
    expect(siteKey('')).toBeUndefined()
  })
  it('matches pages under a member url', () => {
    expect(sameSite('https://gamma.example/blog', 'https://gamma.example/blog/post-1')).toBe(true)
    expect(sameSite('https://gamma.example/blog', 'https://gamma.example/about')).toBe(false)
    expect(sameSite('https://alpha.example', 'https://alpha.example/anything/at/all')).toBe(true)
    expect(sameSite('https://alpha.example', 'https://alpha.example.evil.com/')).toBe(false)
  })
})

describe('findMember', () => {
  it('finds by id before url', () => {
    expect(findMember(ring, { id: 'beta', url: 'https://alpha.example' })?.id).toBe('beta')
  })
  it('finds by referer url', () => {
    expect(findMember(ring, { url: 'https://beta.example/some/page' })?.id).toBe('beta')
    expect(findMember(ring, { url: 'https://gamma.example/blog/x' })?.id).toBe('gamma')
  })
  it('returns undefined for strangers', () => {
    expect(findMember(ring, { id: 'nope', url: 'https://nope.example' })).toBeUndefined()
  })
})

describe('neighbors / pick', () => {
  it('wraps around both ends', () => {
    expect(neighbors(ring, 'alpha')).toMatchObject({ prev: { id: 'gamma' }, next: { id: 'beta' } })
    expect(neighbors(ring, 'gamma')).toMatchObject({ prev: { id: 'beta' }, next: { id: 'alpha' } })
  })
  it('prev/next need a known origin', () => {
    expect(pick(ring, 'next', { from: { id: 'alpha' } })?.id).toBe('beta')
    expect(pick(ring, 'prev', { from: { url: 'https://alpha.example/post' } })?.id).toBe('gamma')
    expect(pick(ring, 'next')).toBeUndefined()
    expect(pick(ring, 'next', { from: { id: 'stranger' } })).toBeUndefined()
  })
  it('random never returns the origin', () => {
    for (let i = 0; i < 50; i++) {
      expect(pick(ring, 'random', { from: { id: 'beta' } })?.id).not.toBe('beta')
    }
  })
  it('random works from anywhere and is deterministic with an rng', () => {
    expect(pick(ring, 'random', { rng: () => 0 })?.id).toBe('alpha')
    expect(pick(ring, 'random', { rng: () => 0.999 })?.id).toBe('gamma')
    expect(pick(ring, 'random', { from: { id: 'alpha' }, rng: () => 0 })?.id).toBe('beta')
  })
  it('single member ring returns itself for random', () => {
    const solo = { ...ring, members: [ring.members[0]!] }
    expect(pick(solo, 'random', { from: { id: 'alpha' } })?.id).toBe('alpha')
    expect(neighbors(solo, 'alpha')).toMatchObject({ prev: { id: 'alpha' }, next: { id: 'alpha' } })
  })
  it('empty ring yields nothing', () => {
    expect(pick({ ...ring, members: [] }, 'random')).toBeUndefined()
  })
})

describe('urls and snippets', () => {
  it('builds navigation urls off the ring url', () => {
    expect(navigationUrls(ring, 'alpha')).toEqual({
      prev: 'https://ring.example/ring/prev?from=alpha',
      next: 'https://ring.example/ring/next?from=alpha',
      random: 'https://ring.example/ring/random?from=alpha',
      index: 'https://ring.example/ring',
    })
    expect(navigationUrls(ring).random).toBe('https://ring.example/ring/random')
  })
  it('embed snippet has fallback links and the script', () => {
    const html = embedSnippet(ring, { memberId: 'alpha' })
    expect(html).toContain('<kinring-banner ring="https://ring.example/ring" member="alpha">')
    expect(html).toContain('href="https://ring.example/ring/prev?from=alpha"')
    expect(html).toContain('<script async src="https://ring.example/ring/embed.js"></script>')
    expect(embedSnippet(ring, { script: false })).not.toContain('<script')
  })
  it('plain snippet has no custom element', () => {
    const html = plainSnippet(ring, { memberId: 'beta' })
    expect(html).not.toContain('kinring-banner')
    expect(html).toContain('random?from=beta')
  })
  it('escapes names in snippets', () => {
    const html = embedSnippet({ ...ring, name: 'A <b> & "c"' })
    expect(html).toContain('A &lt;b&gt; &amp; &quot;c&quot;')
  })
})

describe('feed and opml', () => {
  it('feed exposes public fields only', () => {
    const feed = ringFeed(ring)
    expect(feed.kinring).toBe(1)
    expect(feed.count).toBe(3)
    expect(feed.joinUrl).toBe(ring.url)
    expect(feed.members[2]).toEqual({
      id: 'gamma',
      name: 'Gamma',
      url: 'https://gamma.example/blog',
      button: { src: 'https://gamma.example/b.png' },
    })
  })
  it('opml lists members with feeds', () => {
    const opml = ringOpml(ring)
    expect(opml).toContain('xmlUrl="https://alpha.example/feed.xml"')
    expect(opml).not.toContain('Beta')
  })
})

describe('validateRing', () => {
  it('accepts a good ring', () => {
    const r = validateRing(JSON.parse(JSON.stringify(ring)))
    expect(r.issues).toEqual([])
    expect(r.ring?.members).toHaveLength(3)
  })
  it('reports duplicate ids and sites, bad urls, bad slugs', () => {
    const r = validateRing({
      id: 'Bad Id',
      name: 'x',
      url: 'ftp://nope',
      members: [
        { id: 'a', name: 'A', url: 'https://a.example' },
        { id: 'a', name: 'A2', url: 'https://www.a.example/' },
        { id: 'b', name: 'B', url: 'not a url', button: { src: 'also bad' } },
      ],
    })
    const paths = r.issues.map((i) => i.path)
    expect(r.ring).toBeUndefined()
    expect(paths).toContain('id')
    expect(paths).toContain('url')
    expect(paths).toContain('members[1].id')
    expect(paths).toContain('members[1].url')
    expect(paths).toContain('members[2].url')
    expect(paths).toContain('members[2].button.src')
  })
  it('rejects non-objects', () => {
    expect(validateRing(null).issues[0]?.message).toMatch(/object/)
    expect(validateRing({ id: 'x', name: 'x', url: 'https://x.example', members: 'no' }).issues[0]?.path).toBe('members')
  })
})
