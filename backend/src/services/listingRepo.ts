/* Listings data access. Mirrors the shape/style of userRepo.ts: raw *Row types
   from D1, a toPublic* mapper, and small focused query helpers. Every read
   joins the seller so the UI can render the trust card without a second call. */

/** The five categories the schema's CHECK constraint allows. */
export const CATEGORIES = [
  'movies',
  'concerts',
  'sports',
  'events',
  'travel',
] as const
export type Category = (typeof CATEGORIES)[number]

export const isCategory = (v: unknown): v is Category =>
  typeof v === 'string' && (CATEGORIES as readonly string[]).includes(v)

/** A listing row joined with its seller's public profile columns. */
export type ListingRow = {
  id: number
  seller_id: number
  category: string
  title: string
  venue: string | null
  event_at: string
  seats: string | null
  ticket_count: number
  paid_price: number
  ask_price: number
  screenshot_url: string | null
  city: string | null
  status: string
  created_at: string | null
  seller_name: string
  seller_rating: number
  seller_swaps: number
  seller_verified: number
}

export type PublicListing = {
  id: number
  sellerId: number
  category: string
  title: string
  venue: string | null
  eventAt: string
  seats: string[]
  ticketCount: number
  paid: number
  price: number
  city: string | null
  status: string
  hasScreenshot: boolean
  seller: {
    id: number
    name: string
    rating: number
    swaps: number
    verified: boolean
  }
}

/** Split the stored "G12,G13" seats string into a trimmed, non-empty list. */
const parseSeats = (seats: string | null): string[] =>
  (seats ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

export const toPublicListing = (l: ListingRow): PublicListing => ({
  id: l.id,
  sellerId: l.seller_id,
  category: l.category,
  title: l.title,
  venue: l.venue,
  eventAt: l.event_at,
  seats: parseSeats(l.seats),
  ticketCount: l.ticket_count,
  paid: l.paid_price,
  price: l.ask_price,
  city: l.city,
  status: l.status,
  hasScreenshot: Boolean(l.screenshot_url),
  seller: {
    id: l.seller_id,
    name: l.seller_name,
    rating: l.seller_rating,
    swaps: l.seller_swaps,
    verified: l.seller_verified === 1,
  },
})

// Shared SELECT that pulls the seller's public profile alongside the listing.
const SELECT_JOINED = `
  SELECT l.*,
         u.name AS seller_name,
         u.rating AS seller_rating,
         u.swap_count AS seller_swaps,
         u.id_verified AS seller_verified
    FROM listings l
    JOIN users u ON u.id = l.seller_id`

export type ListingInput = {
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
}

/** Active browse feed, newest-first by event time. Optionally filter by
    category. Backed by idx_listings_browse. */
export async function listActiveListings(
  db: D1Database,
  opts: { category?: Category } = {}
): Promise<PublicListing[]> {
  const where = opts.category
    ? `WHERE l.status = 'active' AND l.category = ?1`
    : `WHERE l.status = 'active'`
  const stmt = db.prepare(`${SELECT_JOINED} ${where} ORDER BY l.event_at ASC`)
  const bound = opts.category ? stmt.bind(opts.category) : stmt
  const { results } = await bound.all<ListingRow>()
  return (results ?? []).map(toPublicListing)
}

/** A single listing with its seller, or null if it doesn't exist. */
export async function getListingById(
  db: D1Database,
  id: number
): Promise<PublicListing | null> {
  const row = await db
    .prepare(`${SELECT_JOINED} WHERE l.id = ?1 LIMIT 1`)
    .bind(id)
    .first<ListingRow>()
  return row ? toPublicListing(row) : null
}

/** Every listing a seller has posted (Profile → Selling), newest-first. */
export async function listListingsBySeller(
  db: D1Database,
  sellerId: number
): Promise<PublicListing[]> {
  const { results } = await db
    .prepare(`${SELECT_JOINED} WHERE l.seller_id = ?1 ORDER BY l.created_at DESC`)
    .bind(sellerId)
    .all<ListingRow>()
  return (results ?? []).map(toPublicListing)
}

/** Toggle a listing in the user's saved set; returns the new saved state. */
export async function toggleSaved(
  db: D1Database,
  userId: number,
  listingId: number
): Promise<{ saved: boolean }> {
  const existing = await db
    .prepare(
      `SELECT 1 FROM saved_listings WHERE user_id = ?1 AND listing_id = ?2 LIMIT 1`
    )
    .bind(userId, listingId)
    .first<{ 1: number }>()

  if (existing) {
    await db
      .prepare(`DELETE FROM saved_listings WHERE user_id = ?1 AND listing_id = ?2`)
      .bind(userId, listingId)
      .run()
    return { saved: false }
  }

  await db
    .prepare(
      `INSERT OR IGNORE INTO saved_listings (user_id, listing_id) VALUES (?1, ?2)`
    )
    .bind(userId, listingId)
    .run()
  return { saved: true }
}

/** Listings the user has saved (Profile → Saved), most-recently-saved first. */
export async function listSavedListings(
  db: D1Database,
  userId: number
): Promise<PublicListing[]> {
  const { results } = await db
    .prepare(
      `${SELECT_JOINED}
         JOIN saved_listings s ON s.listing_id = l.id AND s.user_id = ?1
        ORDER BY s.created_at DESC`
    )
    .bind(userId)
    .all<ListingRow>()
  return (results ?? []).map(toPublicListing)
}

/** Create a listing for a seller and return it with the seller joined. */
export async function createListing(
  db: D1Database,
  sellerId: number,
  input: ListingInput
): Promise<PublicListing> {
  const inserted = await db
    .prepare(
      `INSERT INTO listings
         (seller_id, category, title, venue, event_at, seats,
          ticket_count, paid_price, ask_price, screenshot_url, city, status)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'active')
       RETURNING id`
    )
    .bind(
      sellerId,
      input.category,
      input.title,
      input.venue,
      input.eventAt,
      input.seats.join(','),
      input.ticketCount,
      input.paid,
      input.ask,
      input.hasScreenshot ? 'pending-upload' : null,
      input.city
    )
    .first<{ id: number }>()
  if (!inserted) throw new Error('failed to create listing')
  const listing = await getListingById(db, inserted.id)
  if (!listing) throw new Error('listing vanished after insert')
  return listing
}
