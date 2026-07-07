import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../types/bindings'
import { getSessionConfig, ConfigError } from '../config/env'
import { verifySession } from '../services/session'

/** Requires a valid `Authorization: Bearer <session>` header. On success it
    attaches the principal to the context via `c.set('user', …)`. */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  let config
  try {
    config = getSessionConfig(c.env)
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('Auth misconfigured:', err.message)
      return c.json({ error: 'auth_unavailable' }, 503)
    }
    throw err
  }

  const header = c.req.header('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  try {
    const user = await verifySession(token, config.sessionSecret)
    c.set('user', user)
  } catch {
    return c.json({ error: 'unauthorized' }, 401)
  }

  return next()
}
