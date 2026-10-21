import { EMBED_JS } from './script.js'

export { EMBED_JS }

/**
 * Register the banner element in the current document. Use this when you
 * bundle kinring into your own front end instead of loading `embed.js`.
 * Safe to call more than once; the script returns early if the element is
 * already defined.
 */
export function defineBanner(): void {
  if (typeof document === 'undefined') return
  // eslint-disable-next-line no-new-func
  new Function(EMBED_JS)()
}
