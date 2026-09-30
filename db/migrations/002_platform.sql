CREATE TABLE companies (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('hotel','operator')),
  name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, city TEXT NOT NULL, description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','suspended')),
  created_at TEXT NOT NULL
);
CREATE TABLE company_members (
  company_id TEXT NOT NULL REFERENCES companies(id), user_id TEXT NOT NULL REFERENCES "user"(id),
  role TEXT NOT NULL CHECK(role IN ('hotel_manager','hotel_staff','operator','guide')),
  PRIMARY KEY(company_id,user_id)
);
CREATE INDEX idx_members_user ON company_members(user_id);
CREATE TABLE rooms (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), code TEXT NOT NULL,
  name TEXT NOT NULL, capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 20),
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  UNIQUE(company_id,code)
);
CREATE INDEX idx_rooms_company ON rooms(company_id);
CREATE TABLE guides (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL, bio TEXT NOT NULL, languages TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1))
);
CREATE TABLE tours (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL, description TEXT NOT NULL, city TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 15 AND 1440),
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
  guide_id TEXT REFERENCES guides(id), published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1))
);
CREATE INDEX idx_tours_company ON tours(company_id);
CREATE TABLE departures (
  id TEXT PRIMARY KEY, tour_id TEXT NOT NULL REFERENCES tours(id), starts_at TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 100),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), UNIQUE(tour_id,starts_at)
);
CREATE INDEX idx_departures_tour ON departures(tour_id,starts_at);
CREATE TABLE bookings (
  id TEXT PRIMARY KEY, request_key TEXT NOT NULL, fingerprint TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user"(id), company_id TEXT NOT NULL REFERENCES companies(id),
  kind TEXT NOT NULL CHECK(kind IN ('hotel','tour')),
  room_id TEXT REFERENCES rooms(id), departure_id TEXT REFERENCES departures(id),
  check_in TEXT, check_out TEXT, guests INTEGER NOT NULL CHECK(guests BETWEEN 1 AND 20),
  customer_name TEXT NOT NULL, customer_email TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
  total_cents INTEGER NOT NULL CHECK(total_cents >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','declined','cancelled')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(user_id,request_key),
  CHECK((kind='hotel' AND room_id IS NOT NULL AND departure_id IS NULL AND check_in IS NOT NULL AND check_out>check_in)
    OR (kind='tour' AND room_id IS NULL AND departure_id IS NOT NULL AND check_in IS NULL AND check_out IS NULL))
);
CREATE INDEX idx_bookings_user ON bookings(user_id,created_at DESC);
CREATE INDEX idx_bookings_company ON bookings(company_id,created_at DESC);
CREATE INDEX idx_bookings_room ON bookings(room_id,status,check_in,check_out);
CREATE INDEX idx_bookings_departure ON bookings(departure_id,status);
CREATE TABLE stay_records (
  booking_id TEXT PRIMARY KEY REFERENCES bookings(id), country TEXT NOT NULL, origin_city TEXT NOT NULL,
  checked_in_at TEXT NOT NULL, checked_out_at TEXT
);
CREATE TABLE platform_audit (
  id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES "user"(id), company_id TEXT REFERENCES companies(id),
  action TEXT NOT NULL, entity_id TEXT NOT NULL, created_at TEXT NOT NULL
);
