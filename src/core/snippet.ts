import { escapeXml } from './ring.js'
import { navigationUrls } from './ring.js'
import type { Ring } from './types.js'
import { joinUrl } from './url.js'

export interface SnippetOptions {
  /** The member the snippet is for. Links carry `?from=<id>` so prev/next work without a Referer. */
  memberId?: string | undefined
  /** Include the `<script>` that upgrades the markup into the banner. Default true. */
  script?: boolean | undefined
}

/**
 * The HTML a member pastes into their site. Works with no JavaScript; the
 * script upgrades it into the `<kinring-banner>` component.
 */
export function embedSnippet(ring: Ring, options: SnippetOptions = {}): string {
  const nav = navigationUrls(ring, options.memberId)
  const from = options.memberId ? ` member="${escapeXml(options.memberId)}"` : ''
  const lines = [
    `<kinring-banner ring="${escapeXml(ring.url)}"${from}>`,
    `  <p>Member of <a href="${escapeXml(nav.index)}">${escapeXml(ring.name)}</a></p>`,
    `  <a href="${escapeXml(nav.prev)}" rel="nofollow">Previous</a>`,
    `  <a href="${escapeXml(nav.random)}" rel="nofollow">Random</a>`,
    `  <a href="${escapeXml(nav.next)}" rel="nofollow">Next</a>`,
    `</kinring-banner>`,
  ]
  if (options.script !== false) {
    lines.push(`<script async src="${escapeXml(joinUrl(ring.url, 'embed.js'))}"></script>`)
  }
  return lines.join('\n')
}

/**
 * The plain-links variant for people who want to style everything
 * themselves. No custom element, no script.
 */
export function plainSnippet(ring: Ring, options: Pick<SnippetOptions, 'memberId'> = {}): string {
  const nav = navigationUrls(ring, options.memberId)
  return [
    `<p class="kinring">`,
    `  Member of <a href="${escapeXml(nav.index)}">${escapeXml(ring.name)}</a>:`,
    `  <a href="${escapeXml(nav.prev)}" rel="nofollow">previous</a>,`,
    `  <a href="${escapeXml(nav.random)}" rel="nofollow">random</a>,`,
    `  <a href="${escapeXml(nav.next)}" rel="nofollow">next</a>`,
    `</p>`,
  ].join('\n')
}
