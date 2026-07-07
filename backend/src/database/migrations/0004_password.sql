-- Adds email + password login. Stores only a PBKDF2 hash of the password
-- (see services/password.ts); Google-only accounts leave it null.
-- Safe to run once on a database created from an earlier schema.
ALTER TABLE users ADD COLUMN password_hash TEXT;
