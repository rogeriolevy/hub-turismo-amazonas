ALTER TABLE company_members ADD COLUMN guide_id TEXT REFERENCES guides(id);
CREATE UNIQUE INDEX idx_company_members_guide
  ON company_members(company_id,guide_id) WHERE guide_id IS NOT NULL;
