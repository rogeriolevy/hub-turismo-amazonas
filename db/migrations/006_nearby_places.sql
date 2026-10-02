CREATE TABLE IF NOT EXISTS nearby_place_cache (
  provider_key TEXT PRIMARY KEY,
  source_hash TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  geocoded_at TEXT,
  places_json TEXT NOT NULL DEFAULT '[]',
  places_updated_at TEXT
);
CREATE TABLE IF NOT EXISTS osm_request_limits (
  service TEXT PRIMARY KEY,
  next_allowed_at INTEGER NOT NULL,
  request_date TEXT NOT NULL DEFAULT '',
  request_count INTEGER NOT NULL DEFAULT 0
);
