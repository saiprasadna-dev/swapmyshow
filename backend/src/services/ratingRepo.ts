/* Ratings left after a swap. Each party may rate the other once
   (UNIQUE(swap_id, rater_id)); submitting recomputes the ratee's average
   star rating so trust badges stay current. */

import type { SwapRow } from './swapRepo'
import { getListingById } from './listingRepo'

export type RatingInput = {
  stars: number
  note: string | null
}

export type RatingError = 'invalid_stars' | 'already_rated'

/**
 * Record `raterId`'s rating of the swap counterparty. The ratee is whichever
 * side of the swap the rater is not. Rejects out-of-range stars and a repeat
 * rating (the schema's UNIQUE(swap_id, rater_id) guard). On success the ratee's
 * `users.rating` is recomputed as the average of all ratings they've received.
 */
export async function createRating(
  db: D1Database,
  swap: SwapRow,
  raterId: number,
  input: RatingInput
): Promise<{ ok: true } | { error: RatingError }> {
  if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5) {
    return { error: 'invalid_stars' }
  }

  const listing = await getListingById(db, swap.listing_id)
  const sellerId = listing?.sellerId ?? swap.buyer_id
  const rateeId = raterId === swap.buyer_id ? sellerId : swap.buyer_id

  const inserted = await db
    .prepare(
      `INSERT INTO ratings (swap_id, rater_id, ratee_id, stars, note)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT (swap_id, rater_id) DO NOTHING
       RETURNING id`
    )
    .bind(swap.id, raterId, rateeId, input.stars, input.note)
    .first<{ id: number }>()
  if (!inserted) return { error: 'already_rated' }

  await db
    .prepare(
      `UPDATE users
          SET rating = COALESCE(
            (SELECT ROUND(AVG(stars), 2) FROM ratings WHERE ratee_id = ?1), 0)
        WHERE id = ?1`
    )
    .bind(rateeId)
    .run()

  return { ok: true }
}
