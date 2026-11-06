CREATE TABLE user_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  event TEXT NOT NULL CHECK(event IN (
    'booking.requested',
    'booking.confirmed',
    'booking.declined',
    'booking.cancelled'
  )),
  created_at TEXT NOT NULL,
  read_at TEXT,
  UNIQUE(user_id,booking_id,event)
);

CREATE INDEX idx_user_notifications_inbox
  ON user_notifications(user_id,created_at DESC,id DESC);
