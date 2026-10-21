import type { Ring, RingButton, RingMember } from './types.js'
import { siteKey } from './url.js'

export interface ValidationIssue {
  path: string
  message: string
}

export interface ValidationResult {
  ring?: Ring
  issues: ValidationIssue[]
}

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/

/**
 * Validate an untrusted ring definition (a JSON file, a form submission).
 * Returns the typed ring when there are no issues.
 */
export function validateRing(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = []
  if (!isRecord(input)) return { issues: [{ path: '', message: 'ring must be an object' }] }

  const id = str(input, 'id', issues, { pattern: SLUG })
  const name = str(input, 'name', issues)
  const url = str(input, 'url', issues, { url: true })
  const description = optStr(input, 'description', issues)
  const joinUrl = optStr(input, 'joinUrl', issues, { url: true })

  const members: RingMember[] = []
  if (!Array.isArray(input.members)) {
    issues.push({ path: 'members', message: 'members must be an array' })
  } else {
    const seenIds = new Set<string>()
    const seenSites = new Set<string>()
    input.members.forEach((raw, i) => {
      const path = `members[${i}]`
      if (!isRecord(raw)) {
        issues.push({ path, message: 'member must be an object' })
        return
      }
      const mid = str(raw, 'id', issues, { pattern: SLUG, path })
      const mname = str(raw, 'name', issues, { path })
      const murl = str(raw, 'url', issues, { url: true, path })
      const mdesc = optStr(raw, 'description', issues, { path })
      const mfeed = optStr(raw, 'feed', issues, { url: true, path })
      const button = validateButton(raw.button, `${path}.button`, issues)
      if (mid) {
        if (seenIds.has(mid)) issues.push({ path: `${path}.id`, message: `duplicate member id "${mid}"` })
        seenIds.add(mid)
      }
      if (murl) {
        const key = siteKey(murl)
        if (key && seenSites.has(key)) issues.push({ path: `${path}.url`, message: `duplicate site "${key}"` })
        if (key) seenSites.add(key)
      }
      if (mid && mname && murl) {
        const m: RingMember = { id: mid, name: mname, url: murl }
        if (mdesc) m.description = mdesc
        if (mfeed) m.feed = mfeed
        if (button) m.button = button
        members.push(m)
      }
    })
  }

  if (issues.length > 0 || !id || !name || !url) return { issues }
  const ring: Ring = { id, name, url, members }
  if (description) ring.description = description
  if (joinUrl) ring.joinUrl = joinUrl
  return { ring, issues }
}

export function validateButton(raw: unknown, path: string, issues: ValidationIssue[]): RingButton | undefined {
  if (raw === undefined || raw === null) return undefined
  if (!isRecord(raw)) {
    issues.push({ path, message: 'button must be an object' })
    return undefined
  }
  const src = str(raw, 'src', issues, { url: true, path })
  const src2x = optStr(raw, 'src2x', issues, { url: true, path })
  const alt = optStr(raw, 'alt', issues, { path })
  if (!src) return undefined
  const button: RingButton = { src }
  if (src2x) button.src2x = src2x
  if (alt) button.alt = alt
  return button
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

interface StrOpts {
  pattern?: RegExp
  url?: boolean
  path?: string
}

function str(obj: Record<string, unknown>, key: string, issues: ValidationIssue[], opts: StrOpts = {}): string | undefined {
  const v = obj[key]
  const path = opts.path ? `${opts.path}.${key}` : key
  if (typeof v !== 'string' || v.trim() === '') {
    issues.push({ path, message: `${key} is required` })
    return undefined
  }
  return check(v.trim(), path, issues, opts)
}

function optStr(obj: Record<string, unknown>, key: string, issues: ValidationIssue[], opts: StrOpts = {}): string | undefined {
  const v = obj[key]
  if (v === undefined || v === null || v === '') return undefined
  const path = opts.path ? `${opts.path}.${key}` : key
  if (typeof v !== 'string') {
    issues.push({ path, message: `${key} must be a string` })
    return undefined
  }
  return check(v.trim(), path, issues, opts)
}

function check(v: string, path: string, issues: ValidationIssue[], opts: StrOpts): string | undefined {
  if (opts.pattern && !opts.pattern.test(v)) {
    issues.push({ path, message: 'must be a lowercase slug (a-z, 0-9, hyphens)' })
    return undefined
  }
  if (opts.url) {
    let ok = false
    try {
      const u = new URL(v)
      ok = u.protocol === 'http:' || u.protocol === 'https:'
    } catch {
      ok = false
    }
    if (!ok) {
      issues.push({ path, message: 'must be an absolute http(s) URL' })
      return undefined
    }
  }
  return v
}
