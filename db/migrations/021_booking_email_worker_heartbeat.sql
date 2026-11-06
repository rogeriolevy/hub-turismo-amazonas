CREATE TABLE booking_email_worker_heartbeat (
  worker_id TEXT PRIMARY KEY CHECK(worker_id = 'booking-email-worker'),
  state TEXT NOT NULL CHECK(state IN ('running','disabled','stopped')),
  last_seen_at TEXT NOT NULL
);
