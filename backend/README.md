# SwapMyShow Backend

This directory contains the Cloudflare Workers backend for the SwapMyShow application.

## Overview

- Framework: Hono
- Runtime: Cloudflare Workers
- Language: TypeScript
- Deployment: Wrangler

## Project structure

- `src/` - application source files
- `src/routes/` - route definitions
- `src/controllers/` - controller handlers
- `src/middleware/` - global middleware
- `src/config/` - environment and runtime configuration
- `src/types/` - project-specific TypeScript types
- `dist/` - compiled output

## API endpoints

- `GET /` - health check endpoint returns API running message
- `GET /health` - service health response
- `POST /auth/google` - verify a Google ID token and return a session
- `GET /auth/me` - return the user for a `Authorization: Bearer <session>` token

## Google Sign-In

The frontend obtains a Google ID token (via Google Identity Services) and POSTs
it here. The backend:

1. Verifies the token's RS256 signature against Google's JWKS
   (`https://www.googleapis.com/oauth2/v3/certs`).
2. Checks `iss` (Google), `aud` (our `GOOGLE_CLIENT_ID`), `exp`/`nbf`, and that
   the email is verified.
3. Upserts the user in D1 (`users.google_sub`, linking by email if present).
4. Issues a signed HS256 **session token** (`SESSION_SECRET`), returned to the
   client and sent back as a Bearer token on later requests.

Nothing about the user is trusted from the browser — the session is derived
only from the verified Google claims.

### Configuration

| Variable            | Where          | Notes                                                   |
| ------------------- | -------------- | ------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`  | `wrangler.jsonc` `vars` | OAuth **Web** client id; the `aud` every token must match. |
| `SESSION_SECRET`    | **secret**     | `wrangler secret put SESSION_SECRET` (≥ 32 chars, random). |
| `SESSION_TTL_DAYS`  | `vars`         | Session lifetime, default `7`.                          |
| `ALLOWED_ORIGINS`   | `vars`         | Comma-separated CORS allowlist, or `*`.                 |

Create the OAuth client at
<https://console.cloud.google.com/apis/credentials> → **OAuth client ID →
Web application**, and add your frontend origins to **Authorized JavaScript
origins**. If `GOOGLE_CLIENT_ID`/`SESSION_SECRET` are unset the auth endpoints
fail closed with `503` rather than accepting unverifiable tokens.

### Database

The `users` table needs `google_sub` and `picture` columns. For an existing
database apply the migration; a fresh one from `schema.sql` already has them.

```sh
# existing db
wrangler d1 execute swapmyshow-db --remote --file src/database/migrations/0001_google_auth.sql
# generate a session secret
openssl rand -base64 48 | wrangler secret put SESSION_SECRET
```

## Local development

1. Install dependencies:
   ```sh
   cd backend
   npm install
   ```
2. Start Wrangler in local mode:
   ```sh
   npm run dev
   ```

## Build

```sh
npm run build
```
