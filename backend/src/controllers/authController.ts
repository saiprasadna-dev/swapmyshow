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
  getUserById,
  getUserByEmail,
  getUserByPhone,
  createProfileUser,
  setUserPhone,
  toPublicUser,
} from '../services/userRepo'
import {
  normalizeEmail,
  isValidEmail,
  normalizePhone,
  isValidPhone,
  requestOtp as issueOtp,
  verifyOtp as checkOtp,
} from '../services/otp'
import { sendEmail, buildOtpEmail, MailError } from '../services/mailer'
import { hashPassword, verifyPassword, isValidPassword } from '../services/password'

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

  /** POST /auth/otp/request — email a one-time code.
      `mode: 'signup'` also validates name/phone and enforces that the email and
      phone aren't already registered (one-time registration); `mode: 'login'`
      (default) just sends a code to sign a returning user in. */
  requestOtp: async (c: Context<AppEnv>) => {
    const body = (await c.req.json().catch(() => null)) as {
      email?: unknown
      mode?: unknown
      name?: unknown
      phone?: unknown
      password?: unknown
    } | null
    const rawEmail = typeof body?.email === 'string' ? body.email : ''
    const email = normalizeEmail(rawEmail)
    if (!email || !isValidEmail(email)) {
      return c.json({ error: 'invalid_email' }, 400)
    }

    if (body?.mode === 'signup') {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const phone = normalizePhone(typeof body.phone === 'string' ? body.phone : '')
      const password = typeof body.password === 'string' ? body.password : ''
      if (name.length < 2) return c.json({ error: 'invalid_name' }, 400)
      if (!isValidPhone(phone)) return c.json({ error: 'invalid_phone' }, 400)
      if (!isValidPassword(password)) return c.json({ error: 'weak_password' }, 400)
      // Registration is one-time: reject an already-used email or phone up front
      // so the user is told to log in instead of being sent a pointless code.
      if (await getUserByEmail(c.env.DB, email)) {
        return c.json({ error: 'email_taken' }, 409)
      }
      if (await getUserByPhone(c.env.DB, phone)) {
        return c.json({ error: 'phone_taken' }, 409)
      }
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
      mode?: unknown
      name?: unknown
      phone?: unknown
      password?: unknown
    } | null
    const email = normalizeEmail(typeof body?.email === 'string' ? body.email : '')
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    if (!email || !isValidEmail(email)) {
      return c.json({ error: 'invalid_email' }, 400)
    }
    if (!code) {
      return c.json({ error: 'missing_code' }, 400)
    }

    // The OTP verify endpoint now serves sign-up only — email is proven once
    // here, then all later sign-ins use the password (POST /auth/login).
    if (body?.mode !== 'signup') {
      return c.json({ error: 'unsupported_mode' }, 400)
    }
    // Validate the sign-up profile before burning the code.
    const signupName = typeof body?.name === 'string' ? body.name.trim() : ''
    const signupPhone = normalizePhone(
      typeof body?.phone === 'string' ? body.phone : ''
    )
    const signupPassword = typeof body?.password === 'string' ? body.password : ''
    if (signupName.length < 2) return c.json({ error: 'invalid_name' }, 400)
    if (!isValidPhone(signupPhone)) return c.json({ error: 'invalid_phone' }, 400)
    if (!isValidPassword(signupPassword)) {
      return c.json({ error: 'weak_password' }, 400)
    }

    const otpConfig = getOtpConfig(c.env)
    const result = await checkOtp(c.env.DB, email, code, otpConfig)
    if (!result.ok) {
      return c.json({ error: result.reason }, 401)
    }

    // Re-check uniqueness now that the code is verified (guards a race between
    // requesting and verifying the code).
    if (await getUserByEmail(c.env.DB, email)) {
      return c.json({ error: 'email_taken' }, 409)
    }
    if (await getUserByPhone(c.env.DB, signupPhone)) {
      return c.json({ error: 'phone_taken' }, 409)
    }
    const passwordHash = await hashPassword(signupPassword)
    const user = await createProfileUser(c.env.DB, {
      name: signupName,
      email,
      phone: signupPhone,
      passwordHash,
    })
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

  /** POST /auth/login — email + password sign-in (no OTP). Returns a session
      on a correct password. Errors are deliberately generic
      (`invalid_credentials`) so we don't reveal whether an email exists. */
  login: async (c: Context<AppEnv>) => {
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
      password?: unknown
    } | null
    const email = normalizeEmail(typeof body?.email === 'string' ? body.email : '')
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!email || !isValidEmail(email) || !password) {
      return c.json({ error: 'invalid_credentials' }, 401)
    }

    const existing = await getUserByEmail(c.env.DB, email)
    // Verify even when there's no hash so timing doesn't leak account existence.
    const ok = await verifyPassword(password, existing?.password_hash ?? null)
    if (!existing || !ok) {
      return c.json({ error: 'invalid_credentials' }, 401)
    }

    const token = await issueSession(
      {
        id: existing.id,
        sub: `user:${existing.id}`,
        email: existing.email ?? email,
        name: existing.name,
        picture: existing.picture ?? undefined,
      },
      session.sessionSecret,
      session.sessionTtlDays
    )
    return c.json({ token, user: toPublicUser(existing) })
  },

  /** POST /auth/phone — attach a phone number to the signed-in account. Used
      after Google sign-up (no phone from Google). One-time: fails if a phone is
      already set, or if the number belongs to another account. */
  setPhone: async (c: Context<AppEnv>) => {
    const principal = c.get('user')
    const body = (await c.req.json().catch(() => null)) as {
      phone?: unknown
    } | null
    const phone = normalizePhone(typeof body?.phone === 'string' ? body.phone : '')
    if (!isValidPhone(phone)) return c.json({ error: 'invalid_phone' }, 400)

    const row = await getUserById(c.env.DB, principal.id)
    if (!row) return c.json({ error: 'unauthorized' }, 401)
    if (row.phone) return c.json({ error: 'phone_already_set' }, 409)
    if (await getUserByPhone(c.env.DB, phone)) {
      return c.json({ error: 'phone_taken' }, 409)
    }

    const updated = await setUserPhone(c.env.DB, principal.id, phone)
    if (!updated) return c.json({ error: 'phone_taken' }, 409)
    return c.json({ user: toPublicUser(updated) })
  },

  /** GET /auth/me — return the caller's full, current profile (verification
      flags, rating, swaps) loaded from the database, not just the token
      claims — so the UI reflects live state after a reload. */
  me: async (c: Context<AppEnv>) => {
    const principal = c.get('user')
    const row = await getUserById(c.env.DB, principal.id)
    if (!row) {
      // Valid session but the account is gone — treat as signed out.
      return c.json({ error: 'unauthorized' }, 401)
    }
    return c.json({ user: toPublicUser(row) })
  },
}
