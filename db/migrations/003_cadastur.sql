CREATE TABLE cadastur_imports (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES "user"(id),
  category TEXT NOT NULL CHECK(category IN ('hospedagens','guias','gastronomia','transportes')),
  period TEXT NOT NULL,
  source_json TEXT NOT NULL,
  checksum TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload TEXT,
  status TEXT NOT NULL CHECK(status IN ('preview','committed','expired')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  committed_at TEXT
);
CREATE TABLE cadastur_entries (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK(category IN ('hospedagens','guias','gastronomia','transportes')),
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  uf TEXT NOT NULL,
  city TEXT NOT NULL,
  subtype TEXT NOT NULL,
  registry_status TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  period TEXT NOT NULL,
  data_hash TEXT NOT NULL,
  source_json TEXT NOT NULL,
  import_id TEXT NOT NULL REFERENCES cadastur_imports(id),
  imported_at TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','reviewed')),
  company_id TEXT REFERENCES companies(id),
  guide_id TEXT REFERENCES guides(id),
  UNIQUE(category, external_id)
);
CREATE INDEX cadastur_entries_category_city ON cadastur_entries(category, uf, city);
CREATE INDEX cadastur_imports_actor ON cadastur_imports(actor_id, created_at);
