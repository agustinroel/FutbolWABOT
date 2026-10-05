export const schemaSql = `
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT NOT NULL DEFAULT 'MID' CHECK (position IN ('GK', 'DEF', 'MID', 'FWD')),
  rating REAL NOT NULL DEFAULT 5.0 CHECK (rating >= 1.0 AND rating <= 10.0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_date TEXT NOT NULL UNIQUE,
  capacity INTEGER NOT NULL,
  location TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'PLAYED')),
  score_a INTEGER,
  score_b INTEGER,
  result_recorded_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cancelled_matches (
  match_date TEXT PRIMARY KEY,
  cancelled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roster (
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id),
  status TEXT NOT NULL CHECK (status IN ('CONFIRMED', 'WAITLIST')),
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  team TEXT CHECK (team IN ('A', 'B')),
  PRIMARY KEY (match_id, player_id)
);

CREATE INDEX IF NOT EXISTS roster_queue_idx ON roster(match_id, status, joined_at);

CREATE TABLE IF NOT EXISTS payments (
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id),
  status TEXT NOT NULL CHECK (status IN ('UNPAID', 'PENDING_CONFIRMATION', 'PAID')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS mvp_votes (
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  voter_id TEXT NOT NULL REFERENCES players(id),
  candidate_id TEXT NOT NULL REFERENCES players(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (match_id, voter_id)
);

CREATE TABLE IF NOT EXISTS rating_history (
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id),
  old_rating REAL NOT NULL,
  new_rating REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS attendance (
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id),
  status TEXT NOT NULL CHECK (status IN ('PRESENT', 'NO_SHOW', 'LATE_CANCEL')),
  PRIMARY KEY (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS cancellations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id),
  cancelled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  was_confirmed INTEGER NOT NULL CHECK (was_confirmed IN (0, 1)),
  late INTEGER NOT NULL CHECK (late IN (0, 1))
);
`;
