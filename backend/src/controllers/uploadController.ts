import type { Context } from 'hono'
import type { AppEnv } from '../types/bindings'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export const uploadController = {
  /** POST /uploads — store an image in R2 and return a URL to it. The image is
      sent as the raw request body with its `Content-Type`. Fails closed with
      503 when no bucket is bound. */
  create: async (c: Context<AppEnv>) => {
    const bucket = c.env.UPLOADS
    if (!bucket) return c.json({ error: 'uploads_unavailable' }, 503)

    const contentType = (c.req.header('Content-Type') ?? '').split(';')[0].trim()
    const ext = EXT[contentType]
    if (!ext) return c.json({ error: 'unsupported_type' }, 400)

    const body = await c.req.arrayBuffer()
    if (body.byteLength === 0) return c.json({ error: 'empty_file' }, 400)
    if (body.byteLength > MAX_BYTES) return c.json({ error: 'file_too_large' }, 413)

    const key = `${crypto.randomUUID()}.${ext}`
    await bucket.put(key, body, { httpMetadata: { contentType } })
    return c.json({ url: `/uploads/${key}`, key }, 201)
  },

  /** GET /uploads/:key — stream an uploaded image back (public, cached). */
  get: async (c: Context<AppEnv>) => {
    const bucket = c.env.UPLOADS
    if (!bucket) return c.json({ error: 'not_found' }, 404)

    const key = c.req.param('key') ?? ''
    if (!key) return c.json({ error: 'not_found' }, 404)
    const obj = await bucket.get(key)
    if (!obj) return c.json({ error: 'not_found' }, 404)

    return new Response(obj.body, {
      headers: {
        'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        ETag: obj.httpEtag,
      },
    })
  },
}
