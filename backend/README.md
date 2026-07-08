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
- `POST /auth/password/forgot` - `{ email }` — email a reset code. Always returns
  `ok` for a valid email (never reveals whether an account exists)
- `POST /auth/password/reset` - `{ email, code, password }` — verify the code and
  set a new password; signs the user in on success
- `POST /auth/phone` *(auth)* - attach a phone to the signed-in account (one-time)
- `POST /auth/phone/verify/request` *(auth)* - text the caller a code to verify
  their phone (falls back to a dev `debugCode` — no SMS provider is wired up yet;
  see `services/sms.ts`)
- `POST /auth/phone/verify` *(auth)* - `{ code }` — verify the code and set
  `phone_verified`
- `GET /auth/me` - return the user for a `Authorization: Bearer <session>` token

Sign-up verifies the email with a one-time code; after that, every sign-in uses the
password. Passwords are stored only as a salted PBKDF2 hash (see
`services/password.ts`). Google sign-in is unchanged and has no password.

### Listings

- `GET /listings?category=` - public browse feed of active listings (with seller)
- `GET /listings/:id` - public listing detail
- `POST /listings` *(auth)* - create a listing owned by the caller
- `PATCH /listings/:id` *(auth)* - edit a listing the caller owns (must still be
  `active`; returns `not_editable` for a sold/expired one)
- `DELETE /listings/:id` *(auth)* - soft-cancel a listing the caller owns
  (`status → expired`, drops it out of the browse feed)
- `POST /listings/:id/save` *(auth)* - toggle the listing in the caller's saved set

### Uploads (ticket images)

- `POST /uploads` *(auth)* - store an image (raw body + `Content-Type`) in R2 and
  return `{ url }`. Fails closed with `503 uploads_unavailable` until an R2
  bucket is bound (see the commented `r2_buckets` block in `wrangler.jsonc`:
  `wrangler r2 bucket create swapmyshow-uploads`, uncomment, redeploy).
- `GET /uploads/:key` - stream an uploaded image back (public, cached). A
  listing's `screenshotUrl` points here.
- `GET /me/listings` *(auth)* - the caller's own listings (Profile → Selling)
- `GET /me/saved` *(auth)* - the caller's saved listings (Profile → Saved)

### Swaps & chat

- `POST /listings/:id/swap` *(auth)* - start or resume the caller's swap for a listing
- `GET /swaps/:id` *(auth)* - swap state + joined listing (drives the tracker)
- `GET /swaps/:id/messages?sinceId=` *(auth)* - poll chat history (incremental)
- `POST /swaps/:id/messages` *(auth)* - send a chat message
- `POST /swaps/:id/read` *(auth)* - mark this swap's chat read for the caller
  (clears its unread count)
- `POST /swaps/:id/offer` *(auth)* - propose a price in chat (`{ price }`); posts
  it into the transcript. Either party may offer.
- `POST /swaps/:id/offer/accept` *(auth)* - accept the counterparty's pending
  offer; it becomes the agreed price
- `POST /swaps/:id/confirm` *(auth)* - advance `agree → transfer`
- `POST /swaps/:id/transfer` *(auth)* - seller marks the ticket transferred
- `POST /swaps/:id/receipt` *(auth)* - buyer confirms receipt; finalizes the swap
- `POST /swaps/:id/rate` *(auth)* - rate the counterparty once
- `GET /me/swaps` *(auth)* - swaps the caller has bought into (Profile → Bought)
- `GET /me/conversations` *(auth)* - every chat the caller is in, as **buyer or
  seller** (Messages inbox). Each row carries the counterparty's name and a
  preview of the latest message, newest activity first — this is how a seller
  discovers and replies to buyers who messaged their listings. Each row also
  carries an `unreadCount`.
- `GET /me/unread` *(auth)* - total unread messages across the caller's chats
  (the number behind the Messages nav badge)

When both `transfer` and `receipt` are recorded the swap is marked `done`, the
listing flips to `sold`, and both users' `swap_count` is incremented (one atomic
batch). Ratings recompute the ratee's average `users.rating`.

Optional demo content (a few sellers + active listings) lives in
`src/database/seed.sql` — load it locally with `npm run seed:local`. It is not a
migration, so it never runs in production.

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

### Database & migrations

The schema is managed by **Wrangler's D1 migrations** (`migrations_dir` in
`wrangler.jsonc`). Migration files live in `src/database/migrations/` and are
numbered — `0001_init.sql` is the full baseline; later schema changes ship as
new files (`0002_*.sql`, …). Wrangler records which have run in a
`d1_migrations` table and applies only the new ones, so there's a single source
of truth and no drift.

```sh
npm run migrate         # apply pending migrations to the REMOTE (production) db
npm run migrate:local   # apply to the local dev db
npm run seed:local      # optional: load demo listings locally (src/database/seed.sql)
```

`npm run deploy` runs `npm run migrate` **before** `wrangler deploy`, so every
deployment brings the production database up to date first.

**To change the schema:** add a new migration file (e.g.
`0002_add_something.sql`) with forward-only SQL — never edit `0001_init.sql` or a
migration that has already been applied. `npm run deploy` (or `npm run migrate`)
applies it.

`seed.sql` is demo data (sample sellers + listings). It is **not** a migration —
it never runs in production; load it only in local/dev with `npm run seed:local`.

Secrets still have to be set once per environment:

```sh
# generate a session secret (Windows/macOS/Linux, no openssl needed)
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
wrangler secret put SESSION_SECRET   # paste the value above
wrangler secret put BREVO_API_KEY    # Brevo HTTP API key for emails
```

#### Adopting migrations on an already-built database (one-time)

If your production database was created by hand (e.g. an earlier
`d1 execute --file schema.sql`) rather than by these migrations, tell the
framework the baseline is already present, so it doesn't try to recreate the
tables — then let it apply anything newer:

```sh
# 1) if the users table predates password login, add the column it's missing:
wrangler d1 execute swapmyshow-db --remote \
  --command "ALTER TABLE users ADD COLUMN password_hash TEXT"
#    (skip if it errors with "duplicate column name: password_hash")

# 2) create the tracking table and mark the baseline as already applied:
wrangler d1 execute swapmyshow-db --remote --command "CREATE TABLE IF NOT EXISTS d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL); INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0001_init.sql');"

# 3) from now on, this is a no-op until there are new migrations:
npm run migrate
```

A brand-new database needs none of this — `npm run migrate` builds it from
`0001_init.sql`.

## Local development

1. Install dependencies and set up the local db:
   ```sh
   cd backend
   npm install
   npm run migrate:local     # build the local db from migrations
   npm run seed:local        # optional demo data
   ```
2. Start Wrangler in local mode:
   ```sh
   npm run dev
   ```

## Build

```sh
npm run build
```
