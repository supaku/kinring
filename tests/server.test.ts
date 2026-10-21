import { describe, expect, it } from 'vitest'
import { createRingHandler } from '../src/server/index.js'
import { ring } from './fixtures.js'

const handler = createRingHandler({ loadRing: () => ring, rng: () => 0 })
const get = (path: string, headers: Record<string, string> = {}) =>
  handler(new Request(`https://ring.example${path}`, { headers }))

describe('createRingHandler', () => {
  it('serves ring.json with CORS and caching', async () => {
    const res = await get('/ring/ring.json')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('cache-control')).toContain('max-age=300')
    const body = (await res.json()) as { count: number; kinring: number }
    expect(body.kinring).toBe(1)
    expect(body.count).toBe(3)
  })

  it('serves embed.js as javascript', async () => {
    const res = await get('/ring/embed.js')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('javascript')
    expect(await res.text()).toContain("customElements.define('kinring-banner'")
  })

  it('serves members.opml', async () => {
    const res = await get('/ring/members.opml')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<opml')
  })

  it('redirects next/prev using ?from=', async () => {
    const next = await get('/ring/next?from=alpha')
    expect(next.status).toBe(302)
    expect(next.headers.get('location')).toBe('https://www.beta.example/')
    expect(next.headers.get('cache-control')).toBe('no-store')
    const prev = await get('/ring/prev?from=alpha')
    expect(prev.headers.get('location')).toBe('https://gamma.example/blog')
  })

  it('falls back to the Referer header', async () => {
    const res = await get('/ring/next', { referer: 'https://beta.example/posts/1' })
    expect(res.headers.get('location')).toBe('https://gamma.example/blog')
  })

  it('sends strangers to the ring home', async () => {
    const res = await get('/ring/next', { referer: 'https://stranger.example/' })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://ring.example/ring')
  })

  it('random skips the origin', async () => {
    const res = await get('/ring/random?from=alpha')
    expect(res.headers.get('location')).toBe('https://www.beta.example/')
  })

  it('tolerates trailing slashes and 404s elsewhere', async () => {
    expect((await get('/ring/ring.json/')).status).toBe(200)
    expect((await get('/ring/whatever')).status).toBe(404)
    expect((await get('/elsewhere/next')).status).toBe(404)
  })

  it('rejects non-GET', async () => {
    const res = await handler(new Request('https://ring.example/ring/next', { method: 'POST' }))
    expect(res.status).toBe(405)
  })

  it('honours an explicit basePath', async () => {
    const h = createRingHandler({ loadRing: () => ring, basePath: '/webring/' })
    const res = await h(new Request('https://ring.example/webring/ring.json'))
    expect(res.status).toBe(200)
  })
})
