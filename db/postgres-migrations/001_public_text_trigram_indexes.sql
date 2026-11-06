CREATE OR REPLACE FUNCTION hub_normalize_label(input_text TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $function$
  SELECT regexp_replace(
    regexp_replace(
      normalize(lower(COALESCE(input_text, '')), NFD),
      '[' || chr(768) || '-' || chr(879) || ']',
      '',
      'g'
    ),
    '[^a-z0-9]', '', 'g'
  )
$function$;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE INDEX companies_public_hotel_trade_name_trgm
  ON companies USING gin (hub_normalize_label(trade_name) gin_trgm_ops)
  WHERE kind='hotel' AND status='published';

CREATE INDEX companies_public_hotel_name_trgm
  ON companies USING gin (hub_normalize_label(name) gin_trgm_ops)
  WHERE kind='hotel' AND status='published';

CREATE INDEX companies_public_hotel_city_trgm
  ON companies USING gin (hub_normalize_label(city) gin_trgm_ops)
  WHERE kind='hotel' AND status='published';

CREATE INDEX tours_public_search_name_trgm
  ON tours USING gin (hub_normalize_label(name) gin_trgm_ops)
  WHERE published=1;

CREATE INDEX tours_public_search_city_trgm
  ON tours USING gin (hub_normalize_label(city) gin_trgm_ops)
  WHERE published=1;

CREATE INDEX catalog_public_text_search_trgm
  ON catalog_items USING gin (
    hub_normalize_label(name || ' ' || city || ' ' || subtype || ' ' || summary || ' ' || description || ' ' || details)
      gin_trgm_ops
  )
  WHERE status='published' AND source_entry_id IS NULL;
