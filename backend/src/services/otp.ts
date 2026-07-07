import type { OtpConfig } from '../config/env'

/** Normalize an email for storage/lookup and OTP addressing. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/** Loose but practical email shape check. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
}

/** Normalize a phone number: keep an optional leading + and the digits only. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim()
  const plus = trimmed.startsWith('+') ? '+' : ''
  return plus + trimmed.replace(/\D/g, '')
}

/** Accept 10–15 digits, optionally prefixed with a country code (+). */
export function isValidPhone(phone: string): boolean {
  return /^\+?\d{10,15}$/.test(phone)
}

/** Cryptographically-random numeric code of the requested length. */
export function generateCode(length: number): string {
  const digits = new Uint32Array(length)
  crypto.getRandomValues(digits)
  let out = ''
  for (let i = 0; i < length; i++) out += (digits[i] % 10).toString()
  return out
}

/** SHA-256 hex of "email:code" — the code itself is never stored. */
async function hashCode(email: string, code: string): Promise<string> {
  const data = new TextEncoder().encode(`${email}:${code}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Constant-time-ish comparison of two equal-purpose hex strings. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

type ActiveCodeRow = {
  id: number
  code_hash: string
  attempts: number
  age_seconds: number
}

/** Newest live (unconsumed) code for an email, with its age in seconds. */
async function latestActiveCode(
  db: D1Database,
  email: string
): Promise<ActiveCodeRow | null> {
  return await db
    .prepare(
      `SELECT id, code_hash, attempts,
              CAST(strftime('%s','now') - strftime('%s', created_at) AS INTEGER) AS age_seconds
         FROM otp_codes
        WHERE email = ?1 AND consumed = 0
        ORDER BY id DESC
        LIMIT 1`
    )
    .bind(email)
    .first<ActiveCodeRow>()
}

export type OtpRequestResult =
  | { ok: true; code: string }
  | { ok: false; reason: 'cooldown'; retryAfterSeconds: number }

/**
 * Issue a fresh OTP for an email. Enforces a resend cooldown, invalidates any
 * previous outstanding codes, and returns the plaintext code for the caller to
 * email (it is only ever stored hashed).
 */
export async function requestOtp(
  db: D1Database,
  email: string,
  cfg: OtpConfig
): Promise<OtpRequestResult> {
  const active = await latestActiveCode(db, email)
  if (active && active.age_seconds < cfg.resendCooldownSeconds) {
    return {
      ok: false,
      reason: 'cooldown',
      retryAfterSeconds: cfg.resendCooldownSeconds - active.age_seconds,
    }
  }

  // Supersede any outstanding codes so only the newest one can be used.
  await db
    .prepare(`UPDATE otp_codes SET consumed = 1 WHERE email = ?1 AND consumed = 0`)
    .bind(email)
    .run()

  const code = generateCode(cfg.codeLength)
  const codeHash = await hashCode(email, code)
  await db
    .prepare(`INSERT INTO otp_codes (email, code_hash) VALUES (?1, ?2)`)
    .bind(email, codeHash)
    .run()

  return { ok: true, code }
}

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_code' | 'code_expired' | 'too_many_attempts' }

/**
 * Check a submitted code against the newest live code for the email. On success
 * the code is consumed; on a wrong guess the attempt counter is bumped and the
 * code is burned once attempts are exhausted.
 */
export async function verifyOtp(
  db: D1Database,
  email: string,
  code: string,
  cfg: OtpConfig
): Promise<OtpVerifyResult> {
  const active = await latestActiveCode(db, email)
  if (!active) return { ok: false, reason: 'invalid_code' }

  if (active.age_seconds > cfg.ttlSeconds) {
    await consume(db, active.id)
    return { ok: false, reason: 'code_expired' }
  }
  if (active.attempts >= cfg.maxAttempts) {
    await consume(db, active.id)
    return { ok: false, reason: 'too_many_attempts' }
  }

  const submittedHash = await hashCode(email, code.trim())
  if (!safeEqual(submittedHash, active.code_hash)) {
    const attempts = active.attempts + 1
    if (attempts >= cfg.maxAttempts) {
      await consume(db, active.id)
      return { ok: false, reason: 'too_many_attempts' }
    }
    await db
      .prepare(`UPDATE otp_codes SET attempts = ?1 WHERE id = ?2`)
      .bind(attempts, active.id)
      .run()
    return { ok: false, reason: 'invalid_code' }
  }

  await consume(db, active.id)
  return { ok: true }
}

async function consume(db: D1Database, id: number): Promise<void> {
  await db.prepare(`UPDATE otp_codes SET consumed = 1 WHERE id = ?1`).bind(id).run()
}
