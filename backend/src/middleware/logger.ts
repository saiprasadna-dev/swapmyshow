import type { Context, Next } from 'hono'

export const logger = async (c: Context, next: Next) => {
  const startTime = Date.now()
  await next()
  const duration = Date.now() - startTime
  console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.url} - ${c.res.status} ${duration}ms`)
}
