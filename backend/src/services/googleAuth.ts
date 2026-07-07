import { createRemoteJWKSet, jwtVerify, errors as joseErrors } from 'jose'

/** Google's rotating public keys. Cached in-isolate by jose and refreshed
    automatically when an unknown `kid` is seen. */
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs')
)

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

export type GoogleProfile = {
  sub: string
  email: string
  name: string
  picture?: string
}

/** Raised when a token is present but not acceptable (bad signature, wrong
    audience, expired, unverified email, …). Maps to HTTP 401. */
export class AuthError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'AuthError'
    this.code = code
  }
}

/**
 * Verify a Google ID token end-to-end:
 *  - RS256 signature against Google's JWKS
 *  - `iss` is a Google issuer
 *  - `aud` equals our OAuth client id
 *  - `exp` / `nbf` are valid (enforced by jose)
 *  - the email exists and is verified
 * Returns the trusted profile derived from the signed claims.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string
): Promise<GoogleProfile> {
  let payload: Record<string, unknown>
  try {
    const result = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: GOOGLE_ISSUERS,
      audience: clientId,
    })
    payload = result.payload as Record<string, unknown>
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      throw new AuthError('token_expired', 'Google token has expired')
    }
    if (
      err instanceof joseErrors.JWTClaimValidationFailed ||
      err instanceof joseErrors.JWSSignatureVerificationFailed ||
      err instanceof joseErrors.JWSInvalid ||
      err instanceof joseErrors.JWTInvalid
    ) {
      throw new AuthError('token_invalid', 'Google token failed verification')
    }
    // JWKS fetch failure or anything unexpected
    throw new AuthError('verify_failed', 'Could not verify Google token')
  }

  const sub = typeof payload.sub === 'string' ? payload.sub : ''
  const email = typeof payload.email === 'string' ? payload.email : ''
  const emailVerified =
    payload.email_verified === true || payload.email_verified === 'true'
  const name =
    typeof payload.name === 'string' && payload.name.trim() ? payload.name : email
  const picture = typeof payload.picture === 'string' ? payload.picture : undefined

  if (!sub) throw new AuthError('token_invalid', 'Token is missing a subject')
  if (!email) throw new AuthError('token_invalid', 'Token is missing an email')
  if (!emailVerified) {
    throw new AuthError('email_unverified', 'Google email is not verified')
  }

  return { sub, email, name, picture }
}
