import type { Context, Next } from 'hono'
import type { AppBindings } from '../types/bindings'
import { getConfig } from '../config/env'

/**
 * CORS with a configurable origin allowlist (ALLOWED_ORIGINS).
 * Defaults to "*" for convenience; set an explicit list in production so
 * only your frontend origins are allowed. Auth uses bearer tokens (not
 * cookies), so credentialed CORS is intentionally not enabled.
 */
export const cors = async (c: Context<{ Bindings: AppBindings }>, next: Next) => {
  const { allowedOrigins } = getConfig(c.env)
  const origin = c.req.header('Origin')

  let allowOrigin = ''
  if (allowedOrigins === '*') {
    allowOrigin = '*'
  } else if (origin && allowedOrigins.includes(origin)) {
    allowOrigin = origin
  }

  if (allowOrigin) {
    c.header('Access-Control-Allow-Origin', allowOrigin)
  }
  if (allowOrigin !== '*') {
    c.header('Vary', 'Origin')
  }
  c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  c.header('Access-Control-Max-Age', '86400')

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204)
  }
  return next()
}
