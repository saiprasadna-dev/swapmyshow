import type { Context, Next } from 'hono'

export const cors = async (c: Context, next: Next) => {
  c.header('Access-Control-Allow-Origin', '*')
  c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (c.req.method === 'OPTIONS') {
    return c.text('OK', 200)
  }
  return next()
}
