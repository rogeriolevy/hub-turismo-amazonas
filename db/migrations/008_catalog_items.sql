CREATE TABLE catalog_items (
  id TEXT PRIMARY KEY,
  source_entry_id TEXT UNIQUE REFERENCES cadastur_entries(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK(category IN (
    'hospedagens','gastronomia','passeios','guias','agencias','servicos','navegacao'
  )),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  city TEXT NOT NULL,
  subtype TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL,
  description TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  image_urls_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(category, slug)
);
CREATE INDEX idx_catalog_items_public ON catalog_items(category, status, city, name);
