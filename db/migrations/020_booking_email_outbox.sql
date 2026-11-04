CREATE TABLE booking_email_outbox (
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
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  available_at TEXT NOT NULL,
  locked_until TEXT,
  sent_at TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id,booking_id,event)
);

CREATE INDEX idx_booking_email_outbox_due
  ON booking_email_outbox(status,available_at,created_at,id);
