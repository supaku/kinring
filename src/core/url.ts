/**
 * Reduce a URL to a comparable site key: lower-case host, `www.` stripped,
 * scheme ignored, trailing slash ignored. Two URLs with the same key are the
 * same site for the purposes of membership lookup.
 */
export function siteKey(input: string): string | undefined {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    try {
      url = new URL(`https://${input.trim()}`)
    } catch {
      return undefined
    }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const path = url.pathname.replace(/\/+$/, '')
  return path ? `${host}${path}` : host
}

/**
 * True when `candidate` lives on the same site as `memberUrl`. A member
 * registered as `https://example.com/blog` matches any page under `/blog`;
 * a member registered as `https://example.com` matches the whole host.
 */
export function sameSite(memberUrl: string, candidate: string): boolean {
  const member = siteKey(memberUrl)
  const other = siteKey(candidate)
  if (!member || !other) return false
  if (other === member) return true
  return other.startsWith(`${member}/`)
}

/** Join a base URL and a path without doubling slashes. */
export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}
