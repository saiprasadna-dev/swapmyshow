import { SignJWT, jwtVerify } from 'jose'
import type { SessionUser } from '../types/bindings'

const ISSUER = 'swapmyshow'
const AUDIENCE = 'swapmyshow-web'

const keyOf = (secret: string) => new TextEncoder().encode(secret)

/** Mint a signed session token (HS256) for a verified user. */
export async function issueSession(
  user: SessionUser,
  secret: string,
  ttlDays: number
): Promise<string> {
  return await new SignJWT({
    uid: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttlDays}d`)
    .sign(keyOf(secret))
}

/** Verify a session token and return the principal, or throw. */
export async function verifySession(
  token: string,
  secret: string
): Promise<SessionUser> {
  const { payload } = await jwtVerify(token, keyOf(secret), {
    issuer: ISSUER,
    audience: AUDIENCE,
  })
  const uid = Number(payload.uid)
  const sub = typeof payload.sub === 'string' ? payload.sub : ''
  const email = typeof payload.email === 'string' ? payload.email : ''
  const name = typeof payload.name === 'string' ? payload.name : email
  const picture =
    typeof payload.picture === 'string' ? payload.picture : undefined

  if (!Number.isInteger(uid) || !sub || !email) {
    throw new Error('malformed session claims')
  }
  return { id: uid, sub, email, name, picture }
}
