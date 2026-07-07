export type AppBindings = {
  APP_NAME?: string
  APP_VERSION?: string
  NODE_ENV?: string
  ENVIRONMENT?: string

  /** Comma-separated list of allowed browser origins, or "*" for any. */
  ALLOWED_ORIGINS?: string

  /** Google OAuth Web client id — the "aud" every ID token must match. */
  GOOGLE_CLIENT_ID?: string
  /** Secret used to sign our own session tokens (set via `wrangler secret`). */
  SESSION_SECRET?: string
  /** Session lifetime in days (default 7). */
  SESSION_TTL_DAYS?: string

  /** D1 database binding. */
  DB: D1Database
}

/** The authenticated principal attached to a request by the auth middleware. */
export type SessionUser = {
  id: number
  sub: string
  email: string
  name: string
  picture?: string
}

export type AppVariables = {
  user: SessionUser
}

export type AppEnv = { Bindings: AppBindings; Variables: AppVariables }
