import type { AppBindings } from '../types/bindings'

export type AppConfig = {
  appVersion: string
  nodeEnv: string
  /** "*" means any origin; otherwise an explicit allowlist. */
  allowedOrigins: '*' | string[]
}

/** Safe, non-throwing config for general middleware (cors, health, logging). */
export const getConfig = (env: AppBindings): AppConfig => {
  const raw = (env.ALLOWED_ORIGINS ?? '*').trim()
  const allowedOrigins =
    raw === '*' || raw === ''
      ? '*'
      : raw
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean)
  return {
    appVersion: env.APP_VERSION ?? '1.0.0',
    nodeEnv: env.NODE_ENV ?? env.ENVIRONMENT ?? 'development',
    allowedOrigins,
  }
}

/** Thrown when required auth configuration is missing — the server must
    fail closed rather than accept unverifiable tokens. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

export type SessionConfig = {
  sessionSecret: string
  sessionTtlDays: number
}

/** Everything needed to sign/verify our own session tokens. Required by any
    endpoint that issues or reads a session (Google, email OTP, /auth/me).
    Throws if the signing secret is missing so we fail closed. */
export const getSessionConfig = (env: AppBindings): SessionConfig => {
  const sessionSecret = env.SESSION_SECRET?.trim()
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new ConfigError(
      'SESSION_SECRET is not configured (must be at least 32 characters)'
    )
  }

  const ttl = Number(env.SESSION_TTL_DAYS ?? '7')
  const sessionTtlDays = Number.isFinite(ttl) && ttl > 0 ? ttl : 7

  return { sessionSecret, sessionTtlDays }
}

export type AuthConfig = SessionConfig & {
  googleClientId: string
}

/** Strict auth config for Google sign-in. Throws if the deployment is missing
    the OAuth client id or the session signing secret. */
export const getAuthConfig = (env: AppBindings): AuthConfig => {
  const session = getSessionConfig(env)
  const googleClientId = env.GOOGLE_CLIENT_ID?.trim()
  if (!googleClientId) {
    throw new ConfigError('GOOGLE_CLIENT_ID is not configured')
  }
  return { googleClientId, ...session }
}

export type OtpConfig = {
  /** How long a code stays valid, in seconds. */
  ttlSeconds: number
  /** Minimum wait before a new code can be requested for the same email. */
  resendCooldownSeconds: number
  /** Wrong guesses allowed before a code is burned. */
  maxAttempts: number
  /** Number of digits in the code. */
  codeLength: number
}

/** Tunables for the email OTP flow. Never throws — sensible defaults. */
export const getOtpConfig = (env: AppBindings): OtpConfig => {
  const ttlMin = Number(env.OTP_TTL_MINUTES ?? '10')
  const ttlSeconds = Math.round(
    (Number.isFinite(ttlMin) && ttlMin > 0 ? ttlMin : 10) * 60
  )
  return {
    ttlSeconds,
    resendCooldownSeconds: 60,
    maxAttempts: 5,
    codeLength: 6,
  }
}

export type MailerConfig = {
  /** Present only when Brevo is configured. */
  brevoApiKey?: string
  fromEmail: string
  fromName: string
  appName: string
  /** True when a real provider is wired up; false means dev console fallback. */
  configured: boolean
}

/** Mailer config. When Brevo isn't fully configured, `configured` is false and
    callers should log the code instead of trying to send. Never throws. */
export const getMailerConfig = (env: AppBindings): MailerConfig => {
  const brevoApiKey = env.BREVO_API_KEY?.trim() || undefined
  const fromEmail = env.OTP_FROM_EMAIL?.trim() || ''
  const fromName = env.OTP_FROM_NAME?.trim() || 'SwapMyShow'
  const appName = env.APP_NAME?.trim() || 'SwapMyShow'
  return {
    brevoApiKey,
    fromEmail,
    fromName,
    appName,
    configured: Boolean(brevoApiKey && fromEmail),
  }
}
