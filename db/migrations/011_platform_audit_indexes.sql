CREATE INDEX idx_platform_audit_created
  ON platform_audit(created_at DESC,id DESC);
CREATE INDEX idx_platform_audit_company_created
  ON platform_audit(company_id,created_at DESC,id DESC);
