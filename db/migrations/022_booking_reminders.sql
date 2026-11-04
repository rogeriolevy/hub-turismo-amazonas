CREATE TABLE booking_reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  read_at TEXT,
  UNIQUE(booking_id)
);

CREATE INDEX idx_booking_reminders_inbox
  ON booking_reminders(user_id,created_at DESC,id DESC);
