-- Per-user read state for a swap's chat, so we can show unread badges.
-- One row per (swap, user); `last_read_message_id` is the highest message id
-- that user has seen in that swap. Unread = messages from the other party with
-- a higher id. Forward-only migration — never edit an applied one.
CREATE TABLE IF NOT EXISTS swap_reads (
    swap_id INTEGER NOT NULL REFERENCES swaps(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    last_read_message_id INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (swap_id, user_id)
);
