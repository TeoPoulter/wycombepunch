-- This database is separate from the optional game-score database.
CREATE TABLE IF NOT EXISTS enquiries (
  request_id TEXT PRIMARY KEY,
  payload_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending','accepted','rejected','uncertain')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  upstream_status INTEGER,
  receipt_body TEXT,
  receipt_state TEXT NOT NULL DEFAULT 'waiting' CHECK (receipt_state IN ('waiting','queued','sending','sent','dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  sent_at INTEGER,
  message_id TEXT,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS enquiries_receipt_due ON enquiries(receipt_state, next_attempt_at);
CREATE INDEX IF NOT EXISTS enquiries_retention ON enquiries(created_at);
-- Read-only operator view; no enquiry content or recipient address.
CREATE VIEW IF NOT EXISTS delivery_issues AS
SELECT request_id, state, receipt_state, attempts, upstream_status, last_error, created_at, updated_at
FROM enquiries WHERE state IN ('uncertain','rejected') OR receipt_state = 'dead';
