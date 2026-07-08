import type { Context } from 'hono'
import type { AppEnv } from '../types/bindings'
import {
  listActiveListings,
  getListingById,
  listListingsBySeller,
  listSavedListings,
  toggleSaved,
  createListing,
  updateListing,
  cancelListing,
  isCategory,
  type Category,
} from '../services/listingRepo'

/** Parse and validate the create-listing body. Returns the normalized input or
    an error code the controller can hand back verbatim. */
function parseListingBody(
  body: Record<string, unknown> | null
):
  | {
      category: Category
      title: string
      venue: string | null
      eventAt: string
      seats: string[]
      ticketCount: number
      paid: number
      ask: number
      city: string | null
      hasScreenshot: boolean
      screenshotUrl: string | null
    }
  | { error: string } {
  if (!body) return { error: 'invalid_body' }

  const category = body.category
  if (!isCategory(category)) return { error: 'invalid_category' }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return { error: 'missing_title' }

  const eventAt = typeof body.eventAt === 'string' ? body.eventAt.trim() : ''
  if (!eventAt) return { error: 'missing_event_at' }

  const ask = Number(body.ask)
  if (!Number.isFinite(ask) || ask <= 0) return { error: 'invalid_ask' }

  const paidRaw = Number(body.paid)
  const paid = Number.isFinite(paidRaw) && paidRaw > 0 ? Math.round(paidRaw) : Math.round(ask)

  const seats = Array.isArray(body.seats)
    ? body.seats.map((s) => String(s).trim()).filter(Boolean)
    : typeof body.seats === 'string'
      ? body.seats.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
      : []

  const ticketCountRaw = Number(body.ticketCount)
  const ticketCount =
    Number.isFinite(ticketCountRaw) && ticketCountRaw > 0
      ? Math.round(ticketCountRaw)
      : Math.max(1, seats.length)

  const venue = typeof body.venue === 'string' && body.venue.trim() ? body.venue.trim() : null
  const city = typeof body.city === 'string' && body.city.trim() ? body.city.trim() : null

  // Accept an uploaded image path/URL. Only allow our own upload paths or http
  // URLs so a client can't stuff arbitrary junk into the field.
  const rawShot = typeof body.screenshotUrl === 'string' ? body.screenshotUrl.trim() : ''
  const screenshotUrl =
    rawShot && (rawShot.startsWith('/uploads/') || rawShot.startsWith('http'))
      ? rawShot
      : null

  return {
    category,
    title,
    venue,
    eventAt,
    seats,
    ticketCount,
    paid,
    ask: Math.round(ask),
    city,
    hasScreenshot: Boolean(body.hasScreenshot) || Boolean(screenshotUrl),
    screenshotUrl,
  }
}

export const listingController = {
  /** GET /listings?category= — public browse feed of active listings. */
  list: async (c: Context<AppEnv>) => {
    const categoryParam = c.req.query('category')
    const category = isCategory(categoryParam) ? categoryParam : undefined
    const listings = await listActiveListings(c.env.DB, { category })
    return c.json({ listings })
  },

  /** GET /listings/:id — public listing detail with seller. */
  get: async (c: Context<AppEnv>) => {
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id)) return c.json({ error: 'invalid_id' }, 400)
    const listing = await getListingById(c.env.DB, id)
    if (!listing) return c.json({ error: 'not_found' }, 404)
    return c.json({ listing })
  },

  /** POST /listings — create a listing owned by the caller. */
  create: async (c: Context<AppEnv>) => {
    const user = c.get('user')
    const body = (await c.req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null
    const parsed = parseListingBody(body)
    if ('error' in parsed) return c.json({ error: parsed.error }, 400)

    const listing = await createListing(c.env.DB, user.id, parsed)
    return c.json({ listing }, 201)
  },

  /** PATCH /listings/:id — edit a listing the caller owns and that's still
      active. Same validation as create; refuses sold/expired listings. */
  update: async (c: Context<AppEnv>) => {
    const user = c.get('user')
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id)) return c.json({ error: 'invalid_id' }, 400)

    const existing = await getListingById(c.env.DB, id)
    if (!existing) return c.json({ error: 'not_found' }, 404)
    if (existing.sellerId !== user.id) return c.json({ error: 'forbidden' }, 403)
    if (existing.status !== 'active') {
      return c.json({ error: 'not_editable' }, 409)
    }

    const body = (await c.req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null
    const parsed = parseListingBody(body)
    if ('error' in parsed) return c.json({ error: parsed.error }, 400)

    const listing = await updateListing(c.env.DB, id, user.id, parsed)
    if (!listing) return c.json({ error: 'not_editable' }, 409)
    return c.json({ listing })
  },

  /** DELETE /listings/:id — soft-cancel a listing the caller owns (drops it out
      of the browse feed). Only active listings can be cancelled. */
  remove: async (c: Context<AppEnv>) => {
    const user = c.get('user')
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id)) return c.json({ error: 'invalid_id' }, 400)

    const existing = await getListingById(c.env.DB, id)
    if (!existing) return c.json({ error: 'not_found' }, 404)
    if (existing.sellerId !== user.id) return c.json({ error: 'forbidden' }, 403)

    const cancelled = await cancelListing(c.env.DB, id, user.id)
    if (!cancelled) return c.json({ error: 'not_cancellable' }, 409)
    return c.json({ ok: true })
  },

  /** GET /me/listings — the caller's own listings (Profile → Selling). */
  mine: async (c: Context<AppEnv>) => {
    const user = c.get('user')
    const listings = await listListingsBySeller(c.env.DB, user.id)
    return c.json({ listings })
  },

  /** POST /listings/:id/save — toggle the listing in the caller's saved set. */
  toggleSave: async (c: Context<AppEnv>) => {
    const user = c.get('user')
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id)) return c.json({ error: 'invalid_id' }, 400)
    const listing = await getListingById(c.env.DB, id)
    if (!listing) return c.json({ error: 'not_found' }, 404)
    const result = await toggleSaved(c.env.DB, user.id, id)
    return c.json(result)
  },

  /** GET /me/saved — the caller's saved listings (Profile → Saved). */
  saved: async (c: Context<AppEnv>) => {
    const user = c.get('user')
    const listings = await listSavedListings(c.env.DB, user.id)
    return c.json({ listings })
  },
}
