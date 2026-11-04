ALTER TABLE osm_request_limits
  ADD COLUMN next_allowed_at_ms BIGINT NOT NULL DEFAULT 0;

UPDATE osm_request_limits
SET next_allowed_at_ms = next_allowed_at;
