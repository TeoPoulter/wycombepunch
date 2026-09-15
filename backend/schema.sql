CREATE TABLE IF NOT EXISTS daily_scores (
  day TEXT NOT NULL,
  version TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('precision', 'motion-free')),
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 999),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (day, version, mode)
) WITHOUT ROWID;
