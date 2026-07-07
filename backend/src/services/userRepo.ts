import type { GoogleProfile } from './googleAuth'

export type UserRow = {
  id: number
  name: string
  email: string | null
  picture: string | null
  google_sub: string | null
  id_verified: number
  email_verified: number
  phone_verified: number
  rating: number
  swap_count: number
  created_at: string | null
}

export type PublicUser = {
  id: number
  name: string
  email: string | null
  picture: string | null
  idVerified: boolean
  emailVerified: boolean
  phoneVerified: boolean
  rating: number
  swaps: number
}

export const toPublicUser = (u: UserRow): PublicUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
  picture: u.picture,
  idVerified: u.id_verified === 1,
  emailVerified: u.email_verified === 1,
  phoneVerified: u.phone_verified === 1,
  rating: u.rating,
  swaps: u.swap_count,
})

/** A friendly default display name derived from an email local part. */
const nameFromEmail = (email: string): string => {
  const local = email.split('@')[0] ?? email
  const cleaned = local.replace(/[._-]+/g, ' ').trim()
  if (!cleaned) return email
  return cleaned.replace(/\b\w/g, (ch) => ch.toUpperCase())
}

/**
 * Find-or-create the user for a verified Google profile.
 * Matches on google_sub first, then falls back to email so an account that
 * previously signed up another way gets linked instead of duplicated.
 * A Google-verified sign-in sets id_verified = 1.
 */
export async function upsertGoogleUser(
  db: D1Database,
  p: GoogleProfile
): Promise<UserRow> {
  const existing = await db
    .prepare(
      `SELECT * FROM users WHERE google_sub = ?1 OR email = ?2 ORDER BY google_sub IS NULL LIMIT 1`
    )
    .bind(p.sub, p.email)
    .first<UserRow>()

  if (existing) {
    const updated = await db
      .prepare(
        `UPDATE users
           SET name = ?1,
               email = ?2,
               picture = ?3,
               google_sub = ?4,
               id_verified = 1,
               email_verified = 1
         WHERE id = ?5
         RETURNING *`
      )
      .bind(p.name, p.email, p.picture ?? null, p.sub, existing.id)
      .first<UserRow>()
    if (!updated) throw new Error('failed to update user')
    return updated
  }

  const inserted = await db
    .prepare(
      `INSERT INTO users (name, email, picture, google_sub, id_verified, email_verified)
       VALUES (?1, ?2, ?3, ?4, 1, 1)
       RETURNING *`
    )
    .bind(p.name, p.email, p.picture ?? null, p.sub)
    .first<UserRow>()
  if (!inserted) throw new Error('failed to create user')
  return inserted
}

/**
 * Find-or-create the user for an email proven via OTP. Existing accounts (from
 * Google or a prior OTP sign-in) are matched by email and flagged
 * email_verified; new ones get a friendly default name from the address.
 * Unlike Google, an email OTP does not set id_verified — that badge is reserved
 * for stronger identity checks.
 */
export async function upsertEmailUser(
  db: D1Database,
  email: string
): Promise<UserRow> {
  const existing = await db
    .prepare(`SELECT * FROM users WHERE email = ?1 LIMIT 1`)
    .bind(email)
    .first<UserRow>()

  if (existing) {
    const updated = await db
      .prepare(`UPDATE users SET email_verified = 1 WHERE id = ?1 RETURNING *`)
      .bind(existing.id)
      .first<UserRow>()
    if (!updated) throw new Error('failed to update user')
    return updated
  }

  const inserted = await db
    .prepare(
      `INSERT INTO users (name, email, email_verified)
       VALUES (?1, ?2, 1)
       RETURNING *`
    )
    .bind(nameFromEmail(email), email)
    .first<UserRow>()
  if (!inserted) throw new Error('failed to create user')
  return inserted
}
