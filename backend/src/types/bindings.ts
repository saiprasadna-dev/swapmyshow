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

  /** Brevo (Sendinblue) HTTP API key for sending OTP emails (secret). When
      unset, OTP codes are logged to the console instead of emailed. */
  BREVO_API_KEY?: string
  /** Verified Brevo sender address OTP emails are sent "from". */
  OTP_FROM_EMAIL?: string
  /** Display name on OTP emails (default "SwapMyShow"). */
  OTP_FROM_NAME?: string
  /** OTP lifetime in minutes (default 10). */
  OTP_TTL_MINUTES?: string

  /** D1 database binding. */
  DB: D1Database

  /** R2 bucket for uploaded ticket screenshots. Optional: when the binding
      isn't configured, upload endpoints fail closed (503) and listings simply
      have no image. See `wrangler.jsonc` for how to enable it. */
  UPLOADS?: R2Bucket
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
