# kinring

[![CI](https://github.com/supaku/kinring/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/supaku/kinring/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/kinring)](https://www.npmjs.com/package/kinring)
[![License: MIT](https://img.shields.io/github/license/supaku/kinring)](./LICENSE)

> Build, host, and join webrings. A small TypeScript library with no runtime
> dependencies, a banner web component, a fetch-style server handler, and a
> Payload CMS collection for managing members from an admin panel.

A webring is an ordered list of personal sites. Each site carries a banner
with three links: previous, next, and random. The links point at the ring's
host, which redirects to the right member. kinring is the part that does the
redirecting, plus the pieces around it.

```
   ┌──────────┐      ┌──────────┐      ┌──────────┐
   │ alpha.ex │ ───▶ │ beta.ex  │ ───▶ │ gamma.ex │ ──┐
   └──────────┘      └──────────┘      └──────────┘   │
        ▲                                             │
        └─────────────────────────────────────────────┘
```

Sibling of [kith](https://github.com/supaku/kith). Kith and kin.

---

## Which part do you need?

| You want to…                                         | Use                                     |
| ---------------------------------------------------- | --------------------------------------- |
| join a ring someone else runs                        | [the embed snippet](#joining-a-ring)    |
| run a ring from a JSON file on any host              | `kinring` + `kinring/server`            |
| run a ring and manage members in Payload CMS         | add `kinring/payload`                   |
| compute prev/next/random yourself                    | `kinring` (core)                        |

Node 20.18.1 or newer. ESM only.

```sh
pnpm add kinring
```

---

## Joining a ring

The ring's host gives you a snippet like this. Paste it where you want the
banner to appear. It works with JavaScript off; the script turns the plain
links into a small banner that shows the ring's name and size.

```html
<kinring-banner ring="https://markkropf.com/ring" member="your-slug">
  <p>Member of <a href="https://markkropf.com/ring">Mark's ring</a></p>
  <a href="https://markkropf.com/ring/prev?from=your-slug" rel="nofollow">Previous</a>
  <a href="https://markkropf.com/ring/random?from=your-slug" rel="nofollow">Random</a>
  <a href="https://markkropf.com/ring/next?from=your-slug" rel="nofollow">Next</a>
</kinring-banner>
<script async src="https://markkropf.com/ring/embed.js"></script>
```

Prefer your own markup? Drop the custom element and the script and keep the
three links. `?from=your-slug` tells the ring who you are; without it the ring
falls back to the `Referer` header, which works on most sites but not all.

Style the banner from the outside with shadow parts:

```css
kinring-banner::part(banner) { border-style: dashed; }
kinring-banner::part(name)   { font-weight: 700; }
kinring-banner::part(link)   { text-decoration: none; }
```

### Your button

Rings usually show an 88x31 button for each member. That size is from 1996
and it is still the size. Supply:

- `button.gif`/`.png`/`.webp`/`.svg` at **88x31** pixels (required)
- the same image at **176x62** for high density screens (optional, `src2x`)

Hosts render buttons at 88x31 CSS pixels and use `srcset` for the 2x file.
Animated GIFs are fine. Keep it under 50 KB.

---

## Running a ring

### 1. Define it

A ring is a JSON object. Order matters; it is the order of the ring.

```json
{
  "id": "marks-ring",
  "name": "Mark's ring",
  "url": "https://markkropf.com/ring",
  "description": "Friends with personal sites.",
  "members": [
    {
      "id": "truman",
      "name": "Truman Boyes",
      "url": "https://www.truman.net",
      "feed": "https://www.truman.net/feed.xml",
      "button": { "src": "https://markkropf.com/buttons/truman.png", "src2x": "https://markkropf.com/buttons/truman@2x.png" }
    },
    { "id": "mark", "name": "Mark Kropf", "url": "https://markkropf.com" }
  ]
}
```

`validateRing(json)` checks it and returns every problem at once.

### 2. Serve it

`createRingHandler` is a `(Request) => Promise<Response>` function. Mount it
under your ring's path in any framework that speaks the Fetch API.

Next.js App Router, at `app/ring/[[...action]]/route.ts`:

```ts
import { createRingHandler } from 'kinring/server'
import ring from './ring.json'

const handler = createRingHandler({ loadRing: () => ring })
export const GET = handler
```

That one route serves:

| Path                         | What                                                   |
| ---------------------------- | ------------------------------------------------------ |
| `/ring/prev?from=<id>`       | 302 to the previous member                             |
| `/ring/next?from=<id>`       | 302 to the next member                                 |
| `/ring/random?from=<id>`     | 302 to a random member, never the one you came from    |
| `/ring/ring.json`            | the membership feed, CORS enabled                      |
| `/ring/members.opml`         | every member's RSS feed as OPML                        |
| `/ring/embed.js`             | the banner script                                      |

Unknown origins are sent to the ring's home page rather than a 404. Redirects
are `no-store` and `noindex`.

Other runtimes: Hono, Bun, Deno, Cloudflare Workers, and SvelteKit all take
the same function.

### 3. Build the index page

The ring's home (`ring.url`) is yours to design. The core exports help:

```ts
import { embedSnippet, navigationUrls, ringFeed } from 'kinring'

embedSnippet(ring, { memberId: 'truman' }) // the HTML a member pastes
navigationUrls(ring, 'truman')              // { prev, next, random, index }
ringFeed(ring)                              // what ring.json serves
```

---

## Payload CMS

Manage members in the admin panel instead of a JSON file.

```ts
// payload.config.ts
import { createRingMembersCollection } from 'kinring/payload'

export default buildConfig({
  collections: [
    Media,
    createRingMembersCollection({ slug: 'ring-members', mediaSlug: 'media' }),
  ],
})
```

The collection has `name`, `slug`, `url`, `description`, `feed`, `button`
(upload), `button2x` (upload), `active`, and `order`. Add your own with
`extraFields`, or replace anything with `overrides`.

```ts
// app/ring/[[...action]]/route.ts
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { createRingHandler } from 'kinring/server'
import { loadRingFromPayload } from 'kinring/payload'

export const GET = createRingHandler({
  loadRing: async () =>
    loadRingFromPayload(await getPayload({ config: configPromise }), {
      collection: 'ring-members',
      ring: { id: 'marks-ring', name: "Mark's ring", url: 'https://markkropf.com/ring' },
    }),
})
```

`loadRingFromPayload` reads active members sorted by `order`, turns uploads
into absolute URLs, validates the result, and throws with every issue listed
if an admin edit made the ring invalid.

---

## Core API

```ts
import {
  findMember, neighbors, pick, navigationUrls,
  ringFeed, ringOpml, validateRing, embedSnippet, plainSnippet,
  siteKey, sameSite,
} from 'kinring'
```

- `findMember(ring, { id?, url? })`: by id first, then by site. A member
  registered at `https://x.example/blog` matches pages under `/blog` only.
- `neighbors(ring, id)`: `{ prev, next }`, wrapping at the ends.
- `pick(ring, 'prev' | 'next' | 'random', { from?, rng? })`: what a
  navigation link should land on, or `undefined` when there is nowhere to go.
- `validateRing(unknown)`: `{ ring?, issues[] }`.

---

## Layout

```
src/core      types, url matching, neighbours, validation, snippets
src/server    createRingHandler (Fetch API)
src/embed     the banner script as a string, and defineBanner()
src/payload   createRingMembersCollection, loadRingFromPayload
tests         vitest
```

## Contributing

```sh
pnpm install
pnpm test
pnpm build
```

See [CONTRIBUTING.md](./CONTRIBUTING.md). Security reports go through
[SECURITY.md](./SECURITY.md).

## License

MIT. See [LICENSE](./LICENSE).
