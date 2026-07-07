import type { Context } from 'hono'
import type { AppEnv } from '../types/bindings'
import {
  findOrCreateSwap,
  getSwapForUser,
  confirmSwap,
  markTransferred,
  confirmReceipt,
  listSwapsForUser,
  type SwapError,
} from '../services/swapRepo'
import { listMessages, postMessage } from '../services/messageRepo'
import { createRating } from '../services/ratingRepo'

/** Map a swap-layer error code to an HTTP status. */
const swapStatus = (error: SwapError): 400 | 403 | 404 =>
  error === 'forbidden'
    ? 403
    : error === 'own_listing' || error === 'listing_unavailable'
      ? 400
      : 404

const parseId = (raw: string | undefined): number | null => {
  const id = Number(raw)
  return Number.isInteger(id) ? id : null
}

export const swapController = {
  /** POST /listings/:id/swap — start or resume the caller's swap for a listing. */
  start: async (c: Context<AppEnv>) => {
    const user = c.get('user')
    const listingId = parseId(c.req.param('id'))
    if (listingId === null) return c.json({ error: 'invalid_id' }, 400)

    const result = await findOrCreateSwap(c.env.DB, listingId, user.id)
    if ('error' in result) {
      return c.json({ error: result.error }, swapStatus(result.error))
    }
    return c.json({ swap: result.swap })
  },

  /** GET /swaps/:id — swap state + joined listing for the tracker. */
  get: async (c: Context<AppEnv>) => {
    const user = c.get('user')
    const swapId = parseId(c.req.param('id'))
    if (swapId === null) return c.json({ error: 'invalid_id' }, 400)

    const result = await getSwapForUser(c.env.DB, swapId, user.id)
    if ('error' in result) {
      return c.json({ error: result.error }, swapStatus(result.error))
    }
    return c.json({ swap: result.swap })
  },

  /** GET /swaps/:id/messages?sinceId= — poll chat history. */
  messages: async (c: Context<AppEnv>) => {
    const user = c.get('user')
    const swapId = parseId(c.req.param('id'))
    if (swapId === null) return c.json({ error: 'invalid_id' }, 400)

    const access = await getSwapForUser(c.env.DB, swapId, user.id)
    if ('error' in access) {
      return c.json({ error: access.error }, swapStatus(access.error))
    }

    const sinceId = Number(c.req.query('sinceId') ?? '0')
    const messages = await listMessages(
      c.env.DB,
      swapId,
      Number.isFinite(sinceId) && sinceId > 0 ? sinceId : 0
    )
    return c.json({ messages })
  },

  /** POST /swaps/:id/messages — send a chat message. */
  send: async (c: Context<AppEnv>) => {
    const user = c.get('user')
    const swapId = parseId(c.req.param('id'))
    if (swapId === null) return c.json({ error: 'invalid_id' }, 400)

    const access = await getSwapForUser(c.env.DB, swapId, user.id)
    if ('error' in access) {
      return c.json({ error: access.error }, swapStatus(access.error))
    }

    const body = (await c.req.json().catch(() => null)) as {
      body?: unknown
    } | null
    const text = typeof body?.body === 'string' ? body.body.trim() : ''
    if (!text) return c.json({ error: 'empty_message' }, 400)
    if (text.length > 2000) return c.json({ error: 'message_too_long' }, 400)

    const message = await postMessage(c.env.DB, swapId, user.id, text)
    return c.json({ message }, 201)
  },

  /** POST /swaps/:id/confirm|transfer|receipt — advance the tracker. */
  advance: (action: 'confirm' | 'transfer' | 'receipt') =>
    async (c: Context<AppEnv>) => {
      const user = c.get('user')
      const swapId = parseId(c.req.param('id'))
      if (swapId === null) return c.json({ error: 'invalid_id' }, 400)

      const access = await getSwapForUser(c.env.DB, swapId, user.id)
      if ('error' in access) {
        return c.json({ error: access.error }, swapStatus(access.error))
      }

      if (action === 'confirm') await confirmSwap(c.env.DB, access.row)
      else if (action === 'transfer') await markTransferred(c.env.DB, access.row)
      else await confirmReceipt(c.env.DB, access.row)

      // Re-read so the client sees the up-to-date step and flags.
      const updated = await getSwapForUser(c.env.DB, swapId, user.id)
      if ('error' in updated) {
        return c.json({ error: updated.error }, swapStatus(updated.error))
      }
      return c.json({ swap: updated.swap })
    },

  /** GET /me/swaps — swaps the caller has bought into (Profile → Bought). */
  mine: async (c: Context<AppEnv>) => {
    const user = c.get('user')
    const swaps = await listSwapsForUser(c.env.DB, user.id)
    return c.json({ swaps })
  },

  /** POST /swaps/:id/rate — rate the counterparty once. */
  rate: async (c: Context<AppEnv>) => {
    const user = c.get('user')
    const swapId = parseId(c.req.param('id'))
    if (swapId === null) return c.json({ error: 'invalid_id' }, 400)

    const access = await getSwapForUser(c.env.DB, swapId, user.id)
    if ('error' in access) {
      return c.json({ error: access.error }, swapStatus(access.error))
    }

    const body = (await c.req.json().catch(() => null)) as {
      stars?: unknown
      note?: unknown
    } | null
    const stars = Number(body?.stars)
    const note =
      typeof body?.note === 'string' && body.note.trim() ? body.note.trim() : null

    const result = await createRating(c.env.DB, access.row, user.id, { stars, note })
    if ('error' in result) {
      return c.json({ error: result.error }, result.error === 'invalid_stars' ? 400 : 409)
    }
    return c.json({ ok: true })
  },
}
