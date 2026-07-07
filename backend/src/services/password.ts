/* Password hashing for the Workers runtime. bcrypt/scrypt aren't available, so
   we use PBKDF2 via the Web Crypto API (crypto.subtle) — salted, many rounds,
   with a self-describing stored format so the cost can evolve later:

     pbkdf2$<iterations>$<saltBase64>$<hashBase64>

   Only the hash is ever stored; the plaintext never touches the database. */

const ITERATIONS = 100_000
const KEY_BYTES = 32
const SALT_BYTES = 16

/** Minimum/maximum accepted password length. */
export const isValidPassword = (p: string): boolean =>
  typeof p === 'string' && p.length >= 8 && p.length <= 200

const b64encode = (bytes: Uint8Array): string => {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

const b64decode = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_BYTES * 8
  )
  return new Uint8Array(bits)
}

/** Hash a password into the self-describing stored format. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await derive(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${b64encode(salt)}$${b64encode(hash)}`
}

/** Constant-time-ish comparison of two byte arrays. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/** Verify a password against a stored hash. False on any parse failure. */
export async function verifyPassword(
  password: string,
  stored: string | null
): Promise<boolean> {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  if (!Number.isInteger(iterations) || iterations <= 0) return false
  let salt: Uint8Array<ArrayBuffer>
  let expected: Uint8Array<ArrayBuffer>
  try {
    salt = b64decode(parts[2])
    expected = b64decode(parts[3])
  } catch {
    return false
  }
  const actual = await derive(password, salt, iterations)
  return timingSafeEqual(actual, expected)
}
