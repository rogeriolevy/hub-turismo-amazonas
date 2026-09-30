CREATE TABLE contacts (
  id TEXT PRIMARY KEY NOT NULL,
  idempotency_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT NOT NULL DEFAULT '',
  interest TEXT NOT NULL,
  message TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_contacts_idempotency ON contacts(idempotency_key);
CREATE INDEX idx_contacts_created ON contacts(created_at DESC, id DESC);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY NOT NULL, window INTEGER NOT NULL, attempts INTEGER NOT NULL);
CREATE INDEX idx_rate_limits_window ON rate_limits(window);
