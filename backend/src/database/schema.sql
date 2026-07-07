-- SwapMyShow schema — supports the sign-up → browse → chat → swap → rate flow

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    google_sub TEXT UNIQUE,                   -- Google account id (sign in with Google)
    password_hash TEXT,                        -- PBKDF2 hash for email+password login (null for Google-only)
    picture TEXT,                             -- avatar URL from the identity provider
    id_verified INTEGER NOT NULL DEFAULT 0,   -- trust badges (screen 9)
    email_verified INTEGER NOT NULL DEFAULT 0,-- email proven via Google or email OTP
    phone_verified INTEGER NOT NULL DEFAULT 0,
    rating REAL NOT NULL DEFAULT 0,           -- avg star rating
    swap_count INTEGER NOT NULL DEFAULT 0,    -- successful swaps
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- passwordless email sign-in: short-lived one-time codes ("magic code")
-- Only a hash of the code is stored; rows are single-use and expire quickly.
CREATE TABLE otp_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,                  -- SHA-256 of "email:code"
    attempts INTEGER NOT NULL DEFAULT 0,      -- wrong guesses so far
    consumed INTEGER NOT NULL DEFAULT 0,      -- 1 once used/expired/superseded
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_otp_email ON otp_codes (email, created_at);

-- screens 2/3/4/5: browse, search, listing detail, post a ticket
CREATE TABLE listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL REFERENCES users(id),
    category TEXT NOT NULL CHECK (category IN ('movies','concerts','sports','events','travel')),
    title TEXT NOT NULL,
    venue TEXT,
    event_at TEXT NOT NULL,                   -- ISO datetime; drives Tonight/This week filters + countdowns
    seats TEXT,                               -- e.g. "G12,G13"
    ticket_count INTEGER NOT NULL DEFAULT 1,
    paid_price INTEGER NOT NULL,              -- in paise/rupees, original price
    ask_price INTEGER NOT NULL,               -- seller's ask
    screenshot_url TEXT,                      -- uploaded ticket proof
    city TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','confirmed','sold','expired')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_listings_browse ON listings (status, city, event_at);

-- screens 6/7: chat to confirm → swap confirmed → mark as transferred
CREATE TABLE swaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL REFERENCES listings(id),
    buyer_id INTEGER NOT NULL REFERENCES users(id),
    agreed_price INTEGER NOT NULL,
    step TEXT NOT NULL DEFAULT 'agree' CHECK (step IN ('agree','transfer','rate','done')), -- 1d tracker
    buyer_confirmed_receipt INTEGER NOT NULL DEFAULT 0,  -- "Yes, got it"
    seller_marked_transferred INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    swap_id INTEGER NOT NULL REFERENCES swaps(id),
    sender_id INTEGER NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_messages_swap ON messages (swap_id, created_at);

-- screen 9: rate & trust
CREATE TABLE ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    swap_id INTEGER NOT NULL REFERENCES swaps(id),
    rater_id INTEGER NOT NULL REFERENCES users(id),
    ratee_id INTEGER NOT NULL REFERENCES users(id),
    stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
    note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (swap_id, rater_id)
);

-- screen 4: saved listings ("Save" button)
CREATE TABLE saved_listings (
    user_id INTEGER NOT NULL REFERENCES users(id),
    listing_id INTEGER NOT NULL REFERENCES listings(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, listing_id)
);
