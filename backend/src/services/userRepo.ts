import type { GoogleProfile } from './googleAuth'

export type UserRow = {
  id: number
  name: string
  email: string | null
  phone: string | null
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
  phone: string | null
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
  phone: u.phone,
  picture: u.picture,
  idVerified: u.id_verified === 1,
  emailVerified: u.email_verified === 1,
  phoneVerified: u.phone_verified === 1,
  rating: u.rating,
  swaps: u.swap_count,
})

/** Load a user by primary key, or null if the row no longer exists. */
export async function getUserById(
  db: D1Database,
  id: number
): Promise<UserRow | null> {
  return await db
    .prepare(`SELECT * FROM users WHERE id = ?1 LIMIT 1`)
    .bind(id)
    .first<UserRow>()
}

/** Load a user by email, or null. Used to tell sign-up from log-in. */
export async function getUserByEmail(
  db: D1Database,
  email: string
): Promise<UserRow | null> {
  return await db
    .prepare(`SELECT * FROM users WHERE email = ?1 LIMIT 1`)
    .bind(email)
    .first<UserRow>()
}

/** Load a user by phone number, or null. Enforces one-account-per-phone. */
export async function getUserByPhone(
  db: D1Database,
  phone: string
): Promise<UserRow | null> {
  return await db
    .prepare(`SELECT * FROM users WHERE phone = ?1 LIMIT 1`)
    .bind(phone)
    .first<UserRow>()
}

/**
 * Create a user from the sign-up form (name + email + phone), with the email
 * proven via OTP (email_verified = 1). Phone is stored but not verified — no
 * OTP is sent to it. Callers must have already checked email/phone uniqueness.
 */
export async function createProfileUser(
  db: D1Database,
  input: { name: string; email: string; phone: string }
): Promise<UserRow> {
  const inserted = await db
    .prepare(
      `INSERT INTO users (name, email, phone, email_verified)
       VALUES (?1, ?2, ?3, 1)
       RETURNING *`
    )
    .bind(input.name, input.email, input.phone)
    .first<UserRow>()
  if (!inserted) throw new Error('failed to create user')
  return inserted
}

/** Mark an existing account's email as verified (a returning OTP log-in). */
export async function markEmailVerified(
  db: D1Database,
  id: number
): Promise<UserRow | null> {
  return await db
    .prepare(`UPDATE users SET email_verified = 1 WHERE id = ?1 RETURNING *`)
    .bind(id)
    .first<UserRow>()
}

/**
 * Attach a phone number to an account that doesn't have one yet (one-time).
 * The WHERE guard makes this a no-op if a phone is already set, so it can't be
 * changed later. Returns the updated row, or null if nothing was updated.
 */
export async function setUserPhone(
  db: D1Database,
  id: number,
  phone: string
): Promise<UserRow | null> {
  return await db
    .prepare(
      `UPDATE users SET phone = ?1 WHERE id = ?2 AND phone IS NULL RETURNING *`
    )
    .bind(phone, id)
    .first<UserRow>()
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
