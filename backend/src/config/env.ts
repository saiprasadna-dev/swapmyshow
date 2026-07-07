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

export type AuthConfig = {
  googleClientId: string
  sessionSecret: string
  sessionTtlDays: number
}

/** Thrown when required auth configuration is missing — the server must
    fail closed rather than accept unverifiable tokens. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

/** Strict auth config. Throws if the deployment is missing the secrets
    needed to verify Google tokens or sign sessions. */
export const getAuthConfig = (env: AppBindings): AuthConfig => {
  const googleClientId = env.GOOGLE_CLIENT_ID?.trim()
  const sessionSecret = env.SESSION_SECRET?.trim()

  if (!googleClientId) {
    throw new ConfigError('GOOGLE_CLIENT_ID is not configured')
  }
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new ConfigError(
      'SESSION_SECRET is not configured (must be at least 32 characters)'
    )
  }

  const ttl = Number(env.SESSION_TTL_DAYS ?? '7')
  const sessionTtlDays = Number.isFinite(ttl) && ttl > 0 ? ttl : 7

  return { googleClientId, sessionSecret, sessionTtlDays }
}
