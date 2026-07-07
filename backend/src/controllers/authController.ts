import type { Context } from 'hono'
import type { AppEnv } from '../types/bindings'
import { getAuthConfig, ConfigError } from '../config/env'
import { verifyGoogleIdToken, AuthError } from '../services/googleAuth'
import { issueSession } from '../services/session'
import { upsertGoogleUser, toPublicUser } from '../services/userRepo'

export const authController = {
  /** POST /auth/google — exchange a Google ID token for a session. */
  google: async (c: Context<AppEnv>) => {
    let config
    try {
      config = getAuthConfig(c.env)
    } catch (err) {
      if (err instanceof ConfigError) {
        console.error('Auth misconfigured:', err.message)
        return c.json({ error: 'auth_unavailable' }, 503)
      }
      throw err
    }

    const body = (await c.req.json().catch(() => null)) as {
      credential?: unknown
    } | null
    const credential = body?.credential
    if (typeof credential !== 'string' || !credential) {
      return c.json({ error: 'missing_credential' }, 400)
    }

    try {
      const profile = await verifyGoogleIdToken(credential, config.googleClientId)
      const user = await upsertGoogleUser(c.env.DB, profile)
      const token = await issueSession(
        {
          id: user.id,
          sub: profile.sub,
          email: user.email ?? profile.email,
          name: user.name,
          picture: user.picture ?? undefined,
        },
        config.sessionSecret,
        config.sessionTtlDays
      )
      return c.json({ token, user: toPublicUser(user) })
    } catch (err) {
      if (err instanceof AuthError) {
        return c.json({ error: err.code }, 401)
      }
      throw err
    }
  },

  /** GET /auth/me — return the caller identified by their session token. */
  me: (c: Context<AppEnv>) => {
    const user = c.get('user')
    return c.json({ user })
  },
}
