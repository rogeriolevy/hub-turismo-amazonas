-- Rebuild the two related tables to extend their category checks, retaining all IDs and links.
CREATE TABLE cadastur_imports_next (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES "user"(id),
  category TEXT NOT NULL CHECK(category IN ('hospedagens','guias','gastronomia','transportes','agencias','servicos')),
  period TEXT NOT NULL, source_json TEXT NOT NULL, checksum TEXT NOT NULL,
  summary TEXT NOT NULL, payload TEXT,
  status TEXT NOT NULL CHECK(status IN ('preview','committed','expired')),
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL, committed_at TEXT
);
INSERT INTO cadastur_imports_next SELECT * FROM cadastur_imports;
UPDATE cadastur_imports_next SET status='expired',payload=NULL WHERE status='preview';
CREATE TABLE cadastur_entries_next (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK(category IN ('hospedagens','guias','gastronomia','transportes','agencias','servicos')),
  external_id TEXT NOT NULL, name TEXT NOT NULL, uf TEXT NOT NULL, city TEXT NOT NULL,
  subtype TEXT NOT NULL, registry_status TEXT NOT NULL, valid_until TEXT NOT NULL,
  period TEXT NOT NULL, data_hash TEXT NOT NULL, source_json TEXT NOT NULL,
  import_id TEXT NOT NULL REFERENCES cadastur_imports_next(id), imported_at TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','reviewed')),
  company_id TEXT REFERENCES companies(id), guide_id TEXT REFERENCES guides(id),
  phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '', website TEXT NOT NULL DEFAULT '',
  languages TEXT NOT NULL DEFAULT '', units INTEGER, beds INTEGER,
  published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),
  UNIQUE(category,external_id)
);
INSERT INTO cadastur_entries_next
  (id,category,external_id,name,uf,city,subtype,registry_status,valid_until,period,data_hash,source_json,import_id,imported_at,review_status,company_id,guide_id)
SELECT id,category,external_id,name,uf,city,subtype,registry_status,valid_until,period,data_hash,source_json,import_id,imported_at,review_status,company_id,guide_id FROM cadastur_entries;
DROP TABLE cadastur_entries;
DROP TABLE cadastur_imports;
ALTER TABLE cadastur_imports_next RENAME TO cadastur_imports;
ALTER TABLE cadastur_entries_next RENAME TO cadastur_entries;
CREATE INDEX cadastur_entries_category_city ON cadastur_entries(category,uf,city);
CREATE INDEX cadastur_entries_public ON cadastur_entries(published,category,uf,city,name);
CREATE INDEX cadastur_imports_actor ON cadastur_imports(actor_id,created_at);
