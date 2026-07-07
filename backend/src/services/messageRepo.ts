/* Chat messages within a swap. Reads support incremental polling via `sinceId`
   so the client only fetches what it hasn't seen. Backed by idx_messages_swap. */

export type MessageRow = {
  id: number
  swap_id: number
  sender_id: number
  body: string
  created_at: string | null
}

export type PublicMessage = {
  id: number
  senderId: number
  body: string
  createdAt: string | null
}

const toPublic = (m: MessageRow): PublicMessage => ({
  id: m.id,
  senderId: m.sender_id,
  body: m.body,
  createdAt: m.created_at,
})

/** Messages for a swap in chronological order. When `sinceId` is given, only
    messages newer than that id are returned (incremental poll). */
export async function listMessages(
  db: D1Database,
  swapId: number,
  sinceId = 0
): Promise<PublicMessage[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM messages
        WHERE swap_id = ?1 AND id > ?2
        ORDER BY id ASC`
    )
    .bind(swapId, sinceId)
    .all<MessageRow>()
  return (results ?? []).map(toPublic)
}

/** Append a message to a swap and return the stored row. */
export async function postMessage(
  db: D1Database,
  swapId: number,
  senderId: number,
  body: string
): Promise<PublicMessage> {
  const row = await db
    .prepare(
      `INSERT INTO messages (swap_id, sender_id, body)
       VALUES (?1, ?2, ?3)
       RETURNING *`
    )
    .bind(swapId, senderId, body)
    .first<MessageRow>()
  if (!row) throw new Error('failed to store message')
  return toPublic(row)
}
