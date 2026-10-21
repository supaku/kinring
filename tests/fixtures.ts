import type { Ring } from '../src/index.js'

export const ring: Ring = {
  id: 'test-ring',
  name: 'Test ring',
  url: 'https://ring.example/ring',
  members: [
    { id: 'alpha', name: 'Alpha', url: 'https://alpha.example', feed: 'https://alpha.example/feed.xml' },
    { id: 'beta', name: 'Beta', url: 'https://www.beta.example/' },
    { id: 'gamma', name: 'Gamma', url: 'https://gamma.example/blog', button: { src: 'https://gamma.example/b.png' } },
  ],
}
