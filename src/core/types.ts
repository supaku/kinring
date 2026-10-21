/**
 * A ring is an ordered list of member sites. Order matters: `next` and `prev`
 * walk the list and wrap around at the ends.
 */
export interface Ring {
  /** Stable identifier, used in the JSON feed and the banner. */
  id: string
  /** Display name, e.g. "Mark's ring". */
  name: string
  /** Absolute URL of the ring's home page. Navigation URLs hang off this. */
  url: string
  description?: string
  /** Where a site owner goes to ask to join. Defaults to `url`. */
  joinUrl?: string
  members: RingMember[]
}

export interface RingMember {
  /** Stable slug. Used in `?from=` on navigation links. */
  id: string
  name: string
  /** Absolute URL of the member's site. */
  url: string
  description?: string
  /** RSS or Atom feed, if the member has one. */
  feed?: string
  /** 88x31 button. */
  button?: RingButton
}

export interface RingButton {
  /** 88x31 image URL. GIF, PNG, WebP, or SVG. */
  src: string
  /** 176x62 image for high density screens. Optional. */
  src2x?: string
  alt?: string
}

export type RingAction = 'prev' | 'next' | 'random'

export const RING_ACTIONS: readonly RingAction[] = ['prev', 'next', 'random']

/** The classic button size, in CSS pixels. */
export const BUTTON_SIZE = { width: 88, height: 31 } as const

export function isRingAction(value: string): value is RingAction {
  return (RING_ACTIONS as readonly string[]).includes(value)
}
