CREATE TABLE catalog_media (
  name TEXT PRIMARY KEY,
  content_type TEXT NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp')),
  content_base64 TEXT NOT NULL,
  created_at TEXT NOT NULL
);
