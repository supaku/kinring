// app/ring/[[...action]]/route.ts
//
// Serves /ring/prev, /ring/next, /ring/random, /ring/ring.json,
// /ring/members.opml, and /ring/embed.js from a JSON file.
import { createRingHandler } from '@supaku/kinring/server'
import { validateRing } from '@supaku/kinring'
import raw from './ring.json' with { type: 'json' }

const { ring, issues } = validateRing(raw)
if (!ring) throw new Error(issues.map((i) => `${i.path}: ${i.message}`).join('\n'))

export const GET = createRingHandler({ loadRing: () => ring })
