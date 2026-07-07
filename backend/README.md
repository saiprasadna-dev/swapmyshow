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
- `POST /auth/otp/request` - `{ mode: "signup", name, email, phone, password }` —
  emails a sign-up code after checking the email/phone are free and the password is valid
- `POST /auth/otp/verify` - `{ mode: "signup", name, email, phone, password, code }` —
  verifies the emailed code and creates the account (password stored hashed)
- `POST /auth/login` - `{ email, password }` — email + password sign-in (no OTP);
  a wrong email/password returns a generic `invalid_credentials`
- `POST /auth/phone` *(auth)* - attach a phone to the signed-in account (one-time)
- `GET /auth/me` - return the user for a `Authorization: Bearer <session>` token

Sign-up verifies the email with a one-time code; after that, every sign-in uses the
password. Passwords are stored only as a salted PBKDF2 hash (see
`services/password.ts`). Google sign-in is unchanged and has no password.

### Listings

- `GET /listings?category=` - public browse feed of active listings (with seller)
- `GET /listings/:id` - public listing detail
- `POST /listings` *(auth)* - create a listing owned by the caller
- `POST /listings/:id/save` *(auth)* - toggle the listing in the caller's saved set
- `GET /me/listings` *(auth)* - the caller's own listings (Profile → Selling)
- `GET /me/saved` *(auth)* - the caller's saved listings (Profile → Saved)

### Swaps & chat

- `POST /listings/:id/swap` *(auth)* - start or resume the caller's swap for a listing
- `GET /swaps/:id` *(auth)* - swap state + joined listing (drives the tracker)
- `GET /swaps/:id/messages?sinceId=` *(auth)* - poll chat history (incremental)
- `POST /swaps/:id/messages` *(auth)* - send a chat message
- `POST /swaps/:id/confirm` *(auth)* - advance `agree → transfer`
- `POST /swaps/:id/transfer` *(auth)* - seller marks the ticket transferred
- `POST /swaps/:id/receipt` *(auth)* - buyer confirms receipt; finalizes the swap
- `POST /swaps/:id/rate` *(auth)* - rate the counterparty once
- `GET /me/swaps` *(auth)* - swaps the caller has bought into (Profile → Bought)

When both `transfer` and `receipt` are recorded the swap is marked `done`, the
listing flips to `sold`, and both users' `swap_count` is incremented (one atomic
batch). Ratings recompute the ratee's average `users.rating`.

The database ships seed content in `src/database/migrations/0003_seed.sql` (a few
demo sellers + active listings) so a fresh install isn't empty.

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

## Email OTP Sign-In (passwordless)

For people who don't want to use Google, we email a short one-time code. The
same two calls both sign up and sign in — a first-time email creates the
account, a returning email logs in.

1. `POST /auth/otp/request` with `{ "email": "you@example.com" }`. The backend
   generates a 6-digit code, stores only its **SHA-256 hash** in
   `otp_codes` (never the code itself), and emails the code via Brevo. A resend
   cooldown (60s) and a per-code attempt cap (5) limit brute force. Always
   returns `200` — it never reveals whether the address already has an account.
2. `POST /auth/otp/verify` with `{ "email", "code" }`. On a match the code is
   consumed (single-use), the user is upserted with `email_verified = 1`, and a
   signed **session token** (the same HS256 token Google sign-in issues) is
   returned. Codes expire after `OTP_TTL_MINUTES` (default 10).

An email OTP proves the address, so it sets `email_verified` — but **not**
`id_verified`, which is reserved for stronger identity checks.

When Brevo isn't configured the mailer logs the code to the worker console
instead of sending, and (in `ENVIRONMENT=development` only) the request
response includes a `debugCode` so the flow is testable without a mailbox.

> **Note on "Gmail SMTP":** Cloudflare Workers can't open raw SMTP
> connections, so codes are delivered through Brevo's HTTP API rather than
> Gmail's SMTP server. Set `OTP_FROM_EMAIL` to a sender you've verified in
> Brevo (this can be your Gmail address).

### Configuration

| Variable            | Where          | Notes                                                   |
| ------------------- | -------------- | ------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`  | `wrangler.jsonc` `vars` | OAuth **Web** client id; the `aud` every token must match. |
| `SESSION_SECRET`    | **secret**     | `wrangler secret put SESSION_SECRET` (≥ 32 chars, random). |
| `SESSION_TTL_DAYS`  | `vars`         | Session lifetime, default `7`.                          |
| `ALLOWED_ORIGINS`   | `vars`         | Comma-separated CORS allowlist, or `*`.                 |
| `BREVO_API_KEY`     | **secret**     | `wrangler secret put BREVO_API_KEY` — Brevo HTTP API key for OTP emails. |
| `OTP_FROM_EMAIL`    | `vars`         | Sender address verified in your Brevo account.          |
| `OTP_FROM_NAME`     | `vars`         | Display name on OTP emails, default `SwapMyShow`.       |
| `OTP_TTL_MINUTES`   | `vars`         | Code lifetime in minutes, default `10`.                 |

Create the OAuth client at
<https://console.cloud.google.com/apis/credentials> → **OAuth client ID →
Web application**, and add your frontend origins to **Authorized JavaScript
origins**. If `GOOGLE_CLIENT_ID`/`SESSION_SECRET` are unset the auth endpoints
fail closed with `503` rather than accepting unverifiable tokens.

### Database

A fresh database from `schema.sql` already has everything. For an existing
database, apply the migrations in order — `0001` adds the Google columns and
`0002` adds `users.email_verified` plus the `otp_codes` table.

```sh
# existing db — apply migrations in order
wrangler d1 execute swapmyshow-db --remote --file src/database/migrations/0001_google_auth.sql
wrangler d1 execute swapmyshow-db --remote --file src/database/migrations/0002_email_otp.sql
# generate a session secret
openssl rand -base64 48 | wrangler secret put SESSION_SECRET
# add the Brevo key for OTP email delivery
wrangler secret put BREVO_API_KEY
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
