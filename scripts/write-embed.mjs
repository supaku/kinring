// Writes dist/embed.js from the EMBED_JS string so the banner script can be
// served straight from node_modules or a CDN without a bundler.
import { mkdir, writeFile } from 'node:fs/promises'
import { EMBED_JS } from '../dist/embed/index.js'

await mkdir(new URL('../dist/', import.meta.url), { recursive: true })
await writeFile(new URL('../dist/embed.js', import.meta.url), EMBED_JS, 'utf8')
console.log('wrote dist/embed.js (%d bytes)', Buffer.byteLength(EMBED_JS))
