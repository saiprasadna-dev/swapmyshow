import type { Context, ErrorHandler } from 'hono'

export const errorHandler: ErrorHandler = (err: Error, c: Context) => {
  console.error('Unhandled error:', err.message)
  return c.json({ error: 'Internal Server Error' }, 500)
}
