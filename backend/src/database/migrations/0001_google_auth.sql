-- Adds Google Sign-In support to an existing users table.
-- Safe to run once on a database created from the original schema.
ALTER TABLE users ADD COLUMN google_sub TEXT;
ALTER TABLE users ADD COLUMN picture TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users (google_sub);
