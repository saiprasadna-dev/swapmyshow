-- Seed demo content so browse/listing screens have something to show on a
-- fresh database. Idempotent: fixed high ids + INSERT OR IGNORE, so re-running
-- is a no-op. event_at is relative to the moment this migration runs, which
-- keeps the samples upcoming for a first look at the app.
--
-- Demo seller ids start at 1001 so they never collide with real sign-ups
-- (AUTOINCREMENT hands the next account an id above the highest seeded one).

INSERT OR IGNORE INTO users
  (id, name, email, id_verified, email_verified, phone_verified, rating, swap_count)
VALUES
  (1001, 'Rahul S.',  'rahul.demo@swapmyshow.app',  1, 1, 1, 4.9, 23),
  (1002, 'Meera D.',  'meera.demo@swapmyshow.app',  1, 1, 1, 4.7, 11),
  (1003, 'Vikram P.', 'vikram.demo@swapmyshow.app', 1, 1, 1, 4.6, 8),
  (1004, 'Sana R.',   'sana.demo@swapmyshow.app',   0, 1, 0, 5.0, 4),
  (1005, 'Arjun M.',  'arjun.demo@swapmyshow.app',  1, 1, 1, 4.8, 15);

INSERT OR IGNORE INTO listings
  (id, seller_id, category, title, venue, event_at, seats, ticket_count, paid_price, ask_price, city, status)
VALUES
  (2001, 1001, 'movies',   'Dune: Part Two',     'PVR Nexus · Screen 4', datetime('now', '+2 hours'),           'G12,G13', 2, 320,  180,  'Bengaluru', 'active'),
  (2002, 1002, 'concerts', 'Indie Night Live',   'Phoenix Arena',        datetime('now', '+1 day', '+8 hours'), 'GA',      1, 1100, 900,  'Bengaluru', 'active'),
  (2003, 1003, 'sports',   'IPL Match',          'Chepauk · Stand D',    datetime('now', '+1 day', '+7 hours'), 'D-214',   1, 1500, 1200, 'Chennai',   'active'),
  (2004, 1004, 'events',   'Standup: Late Show', 'The Comedy House',     datetime('now', '+3 hours'),           'A4',      1, 499,  350,  'Bengaluru', 'active'),
  (2005, 1005, 'concerts', 'Sufi Night',         'Ravindra Bharathi',    datetime('now', '+3 days'),            'B10,B11', 2, 800,  600,  'Hyderabad', 'active');
