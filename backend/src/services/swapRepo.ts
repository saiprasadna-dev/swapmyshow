/* Swaps: the buyer↔seller transaction started from a listing. Drives the
   3-step tracker (agree → transfer → rate) and, on completion, flips the
   listing to sold and credits both users a successful swap. */

import { getListingById, type PublicListing } from './listingRepo'
import { getUserById } from './userRepo'

/** DB step values. The UI tracker maps agree→1, transfer→2, rate/done→3. */
export type SwapStep = 'agree' | 'transfer' | 'rate' | 'done'

export type SwapRow = {
  id: number
  listing_id: number
  buyer_id: number
  agreed_price: number
  step: SwapStep
  buyer_confirmed_receipt: number
  seller_marked_transferred: number
  created_at: string | null
}

export type PublicSwap = {
  id: number
  listingId: number
  buyerId: number
  sellerId: number
  agreedPrice: number
  step: SwapStep
  buyerConfirmedReceipt: boolean
  sellerMarkedTransferred: boolean
  /** The caller's role in this swap, so the client can show the right actions. */
  role: 'buyer' | 'seller'
  /** The buyer's display name — so the seller side of a chat can show who it
      is with (the seller is already available via `listing.seller`). */
  buyerName: string
  listing: PublicListing
}

const rowToPublic = (
  row: SwapRow,
  listing: PublicListing,
  userId: number,
  buyerName = ''
): PublicSwap => ({
  id: row.id,
  listingId: row.listing_id,
  buyerId: row.buyer_id,
  sellerId: listing.sellerId,
  agreedPrice: row.agreed_price,
  step: row.step,
  buyerConfirmedReceipt: row.buyer_confirmed_receipt === 1,
  sellerMarkedTransferred: row.seller_marked_transferred === 1,
  role: userId === row.buyer_id ? 'buyer' : 'seller',
  buyerName,
  listing,
})

/** Reasons a swap action can be refused, surfaced as error codes to the client. */
export type SwapError =
  | 'listing_not_found'
  | 'own_listing'
  | 'listing_unavailable'
  | 'not_found'
  | 'forbidden'

/**
 * Find the buyer's existing swap for a listing, or start a new one at the
 * 'agree' step. The seller cannot swap their own listing, and only active
 * listings can be opened. The agreed price defaults to the seller's ask.
 */
export async function findOrCreateSwap(
  db: D1Database,
  listingId: number,
  buyerId: number
): Promise<{ swap: PublicSwap } | { error: SwapError }> {
  const listing = await getListingById(db, listingId)
  if (!listing) return { error: 'listing_not_found' }
  if (listing.sellerId === buyerId) return { error: 'own_listing' }

  const existing = await db
    .prepare(
      `SELECT * FROM swaps WHERE listing_id = ?1 AND buyer_id = ?2 LIMIT 1`
    )
    .bind(listingId, buyerId)
    .first<SwapRow>()
  if (existing) return { swap: rowToPublic(existing, listing, buyerId) }

  if (listing.status !== 'active') return { error: 'listing_unavailable' }

  const created = await db
    .prepare(
      `INSERT INTO swaps (listing_id, buyer_id, agreed_price, step)
       VALUES (?1, ?2, ?3, 'agree')
       RETURNING *`
    )
    .bind(listingId, buyerId, listing.price)
    .first<SwapRow>()
  if (!created) throw new Error('failed to create swap')
  return { swap: rowToPublic(created, listing, buyerId) }
}

/**
 * Load a swap the user is allowed to see (they must be the buyer or the
 * listing's seller). Returns the swap plus the joined listing, or an error.
 */
export async function getSwapForUser(
  db: D1Database,
  swapId: number,
  userId: number
): Promise<{ swap: PublicSwap; row: SwapRow } | { error: SwapError }> {
  const row = await db
    .prepare(`SELECT * FROM swaps WHERE id = ?1 LIMIT 1`)
    .bind(swapId)
    .first<SwapRow>()
  if (!row) return { error: 'not_found' }

  const listing = await getListingById(db, row.listing_id)
  if (!listing) return { error: 'not_found' }
  if (userId !== row.buyer_id && userId !== listing.sellerId) {
    return { error: 'forbidden' }
  }
  const buyer = await getUserById(db, row.buyer_id)
  return { swap: rowToPublic(row, listing, userId, buyer?.name ?? ''), row }
}

/** Finalize once the seller has transferred and the buyer has confirmed
    receipt: mark the swap done, sell the listing, and credit both users a
    successful swap — all in one atomic batch. No-op if already done. */
async function maybeFinalize(db: D1Database, row: SwapRow): Promise<void> {
  const bothDone =
    row.seller_marked_transferred === 1 && row.buyer_confirmed_receipt === 1
  if (!bothDone || row.step === 'done') return

  const listing = await getListingById(db, row.listing_id)
  if (!listing) return
  await db.batch([
    db
      .prepare(`UPDATE swaps SET step = 'done' WHERE id = ?1`)
      .bind(row.id),
    db
      .prepare(`UPDATE listings SET status = 'sold' WHERE id = ?1`)
      .bind(row.listing_id),
    db
      .prepare(`UPDATE users SET swap_count = swap_count + 1 WHERE id = ?1`)
      .bind(row.buyer_id),
    db
      .prepare(`UPDATE users SET swap_count = swap_count + 1 WHERE id = ?1`)
      .bind(listing.sellerId),
  ])
}

/** Advance an agreed-upon swap from 'agree' to 'transfer'. Either party may
    confirm the agreement. */
export async function confirmSwap(db: D1Database, row: SwapRow): Promise<void> {
  if (row.step === 'agree') {
    await db
      .prepare(`UPDATE swaps SET step = 'transfer' WHERE id = ?1`)
      .bind(row.id)
      .run()
  }
}

/** Seller marks the e-ticket as transferred; moves the tracker to 'rate' and
    finalizes if the buyer has already confirmed receipt. */
export async function markTransferred(
  db: D1Database,
  row: SwapRow
): Promise<void> {
  await db
    .prepare(
      `UPDATE swaps
          SET seller_marked_transferred = 1,
              step = CASE WHEN step IN ('agree','transfer') THEN 'rate' ELSE step END
        WHERE id = ?1`
    )
    .bind(row.id)
    .run()
  await maybeFinalize(db, {
    ...row,
    seller_marked_transferred: 1,
    step: row.step === 'agree' || row.step === 'transfer' ? 'rate' : row.step,
  })
}

/** Buyer confirms they received the ticket; moves the tracker to 'rate' and
    finalizes if the seller has already marked it transferred. */
export async function confirmReceipt(
  db: D1Database,
  row: SwapRow
): Promise<void> {
  await db
    .prepare(
      `UPDATE swaps
          SET buyer_confirmed_receipt = 1,
              step = CASE WHEN step IN ('agree','transfer') THEN 'rate' ELSE step END
        WHERE id = ?1`
    )
    .bind(row.id)
    .run()
  await maybeFinalize(db, {
    ...row,
    buyer_confirmed_receipt: 1,
    step: row.step === 'agree' || row.step === 'transfer' ? 'rate' : row.step,
  })
}

/** All swaps where the user is the buyer (Profile → Bought), newest-first. */
export async function listSwapsForUser(
  db: D1Database,
  userId: number
): Promise<PublicSwap[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM swaps WHERE buyer_id = ?1 ORDER BY created_at DESC`
    )
    .bind(userId)
    .all<SwapRow>()

  const swaps: PublicSwap[] = []
  for (const row of results ?? []) {
    const listing = await getListingById(db, row.listing_id)
    if (listing) swaps.push(rowToPublic(row, listing, userId))
  }
  return swaps
}

/** A swap surfaced in the Messages inbox: the swap plus the counterparty's
    name and a preview of the most recent message. */
export type PublicConversation = PublicSwap & {
  /** The other person in this chat (buyer if you're the seller, and vice-versa). */
  counterpartyName: string
  /** Body of the latest message, or null if no one has written yet. */
  lastMessage: string | null
  lastMessageAt: string | null
  /** Messages from the counterparty the caller hasn't read yet. */
  unreadCount: number
}

type ConversationRow = SwapRow & {
  buyer_name: string
  last_body: string | null
  last_at: string | null
  unread_count: number
}

/**
 * Every conversation the user is part of — swaps they started (buyer) *and*
 * swaps opened against their listings (seller) — newest activity first. This
 * is what lets a seller see and reply to buyers who messaged them.
 */
export async function listConversationsForUser(
  db: D1Database,
  userId: number
): Promise<PublicConversation[]> {
  const { results } = await db
    .prepare(
      `SELECT s.*,
              b.name AS buyer_name,
              (SELECT m.body FROM messages m WHERE m.swap_id = s.id
                 ORDER BY m.id DESC LIMIT 1) AS last_body,
              (SELECT m.created_at FROM messages m WHERE m.swap_id = s.id
                 ORDER BY m.id DESC LIMIT 1) AS last_at,
              (SELECT COUNT(*) FROM messages m
                 WHERE m.swap_id = s.id AND m.sender_id != ?1
                   AND m.id > COALESCE(
                     (SELECT r.last_read_message_id FROM swap_reads r
                        WHERE r.swap_id = s.id AND r.user_id = ?1), 0)
              ) AS unread_count
         FROM swaps s
         JOIN listings l ON l.id = s.listing_id
         JOIN users b ON b.id = s.buyer_id
        WHERE s.buyer_id = ?1 OR l.seller_id = ?1
        ORDER BY COALESCE(
          (SELECT m.created_at FROM messages m WHERE m.swap_id = s.id
             ORDER BY m.id DESC LIMIT 1),
          s.created_at
        ) DESC`
    )
    .bind(userId)
    .all<ConversationRow>()

  const conversations: PublicConversation[] = []
  for (const row of results ?? []) {
    const listing = await getListingById(db, row.listing_id)
    if (!listing) continue
    const swap = rowToPublic(row, listing, userId, row.buyer_name)
    const counterpartyName =
      swap.role === 'buyer' ? listing.seller.name : row.buyer_name
    conversations.push({
      ...swap,
      counterpartyName,
      lastMessage: row.last_body ?? null,
      lastMessageAt: row.last_at ?? null,
      unreadCount: row.unread_count ?? 0,
    })
  }
  return conversations
}

/** Total unread messages across every conversation the user is in (the number
    behind the Messages nav badge). Cheap single-row aggregate. */
export async function countUnreadForUser(
  db: D1Database,
  userId: number
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count
         FROM messages m
         JOIN swaps s ON s.id = m.swap_id
         JOIN listings l ON l.id = s.listing_id
        WHERE m.sender_id != ?1
          AND (s.buyer_id = ?1 OR l.seller_id = ?1)
          AND m.id > COALESCE(
            (SELECT r.last_read_message_id FROM swap_reads r
               WHERE r.swap_id = s.id AND r.user_id = ?1), 0)`
    )
    .bind(userId)
    .first<{ count: number }>()
  return row?.count ?? 0
}

/** Mark every message in a swap as read for this user (up to the latest id).
    Idempotent upsert into swap_reads. Caller must have verified access. */
export async function markSwapRead(
  db: D1Database,
  swapId: number,
  userId: number
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO swap_reads (swap_id, user_id, last_read_message_id, updated_at)
       VALUES (?1, ?2,
               (SELECT COALESCE(MAX(id), 0) FROM messages WHERE swap_id = ?1),
               CURRENT_TIMESTAMP)
       ON CONFLICT(swap_id, user_id) DO UPDATE SET
         last_read_message_id = excluded.last_read_message_id,
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind(swapId, userId)
    .run()
}
