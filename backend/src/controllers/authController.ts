import type { Context } from 'hono'
import type { AppEnv } from '../types/bindings'
import {
  getAuthConfig,
  getSessionConfig,
  getOtpConfig,
  getMailerConfig,
  ConfigError,
} from '../config/env'
import { verifyGoogleIdToken, AuthError } from '../services/googleAuth'
import { issueSession } from '../services/session'
import {
  upsertGoogleUser,
  upsertEmailUser,
  toPublicUser,
} from '../services/userRepo'
import {
  normalizeEmail,
  isValidEmail,
  requestOtp as issueOtp,
  verifyOtp as checkOtp,
} from '../services/otp'
import { sendEmail, buildOtpEmail, MailError } from '../services/mailer'

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

  /** POST /auth/otp/request — email a one-time sign-in code. */
  requestOtp: async (c: Context<AppEnv>) => {
    const body = (await c.req.json().catch(() => null)) as {
      email?: unknown
    } | null
    const rawEmail = typeof body?.email === 'string' ? body.email : ''
    const email = normalizeEmail(rawEmail)
    if (!email || !isValidEmail(email)) {
      return c.json({ error: 'invalid_email' }, 400)
    }

    const otpConfig = getOtpConfig(c.env)
    const result = await issueOtp(c.env.DB, email, otpConfig)
    if (!result.ok) {
      c.header('Retry-After', String(result.retryAfterSeconds))
      return c.json(
        { error: 'otp_cooldown', retryAfterSeconds: result.retryAfterSeconds },
        429
      )
    }

    const mailer = getMailerConfig(c.env)
    const ttlMinutes = Math.round(otpConfig.ttlSeconds / 60)
    const mail = buildOtpEmail(mailer.appName, result.code, ttlMinutes)
    try {
      const { delivered } = await sendEmail(mailer, {
        to: email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      })
      // In local dev with no provider wired up, hand the code back so the
      // flow is testable without a mailbox. Never do this once configured.
      const devMode =
        !delivered && (c.env.ENVIRONMENT ?? 'development') === 'development'
      return c.json({
        ok: true,
        ...(devMode ? { debugCode: result.code } : {}),
      })
    } catch (err) {
      if (err instanceof MailError) {
        console.error('OTP email delivery failed:', err.message)
        return c.json({ error: 'email_send_failed' }, 502)
      }
      throw err
    }
  },

  /** POST /auth/otp/verify — exchange an emailed code for a session. */
  verifyOtp: async (c: Context<AppEnv>) => {
    let session
    try {
      session = getSessionConfig(c.env)
    } catch (err) {
      if (err instanceof ConfigError) {
        console.error('Auth misconfigured:', err.message)
        return c.json({ error: 'auth_unavailable' }, 503)
      }
      throw err
    }

    const body = (await c.req.json().catch(() => null)) as {
      email?: unknown
      code?: unknown
    } | null
    const email = normalizeEmail(typeof body?.email === 'string' ? body.email : '')
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    if (!email || !isValidEmail(email)) {
      return c.json({ error: 'invalid_email' }, 400)
    }
    if (!code) {
      return c.json({ error: 'missing_code' }, 400)
    }

    const otpConfig = getOtpConfig(c.env)
    const result = await checkOtp(c.env.DB, email, code, otpConfig)
    if (!result.ok) {
      return c.json({ error: result.reason }, 401)
    }

    const user = await upsertEmailUser(c.env.DB, email)
    const token = await issueSession(
      {
        id: user.id,
        sub: `user:${user.id}`,
        email: user.email ?? email,
        name: user.name,
        picture: user.picture ?? undefined,
      },
      session.sessionSecret,
      session.sessionTtlDays
    )
    return c.json({ token, user: toPublicUser(user) })
  },

  /** GET /auth/me — return the caller identified by their session token. */
  me: (c: Context<AppEnv>) => {
    const user = c.get('user')
    return c.json({ user })
  },
}
