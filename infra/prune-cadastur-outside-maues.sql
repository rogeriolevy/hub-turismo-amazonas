-- One-time production data cleanup. Do not run before BACK-01 is complete and a fresh
-- PostgreSQL backup has passed checksum and restore validation.
-- The exact counts below are a fail-closed snapshot from the read-only audit on 2026-11-04.
-- This script removes only non-Maués Cadastur entries; it preserves import/audit history,
-- accounts, bookings, media, and the original data/hub.sqlite source.

BEGIN;

LOCK TABLE cadastur_imports, cadastur_entries, companies, guides, catalog_items, tours
  IN SHARE ROW EXCLUSIVE MODE;

DO $maues_cleanup$
DECLARE
  maues_rows BIGINT;
  outside_rows BIGINT;
  linked_rows BIGINT;
  outside_guide_rows BIGINT;
  import_history_rows BIGINT;
  committed_import_rows BIGINT;
  import_payload_rows BIGINT;
  outside_catalog_rows BIGINT;
  outside_company_rows BIGINT;
  outside_tour_rows BIGINT;
  deleted_rows BIGINT;
  remaining_outside_rows BIGINT;
  remaining_import_history_rows BIGINT;
  remaining_committed_import_rows BIGINT;
  remaining_import_payload_rows BIGINT;
BEGIN
  SELECT COUNT(*) INTO maues_rows
  FROM cadastur_entries
  WHERE city = U&'Mau\00E9s';

  SELECT COUNT(*) INTO outside_rows
  FROM cadastur_entries
  WHERE city IS DISTINCT FROM U&'Mau\00E9s';

  SELECT COUNT(*) INTO linked_rows
  FROM cadastur_entries
  WHERE city IS DISTINCT FROM U&'Mau\00E9s'
    AND (company_id IS NOT NULL OR guide_id IS NOT NULL);

  SELECT COUNT(*) INTO outside_guide_rows
  FROM guides AS g
  LEFT JOIN companies AS c ON c.id = g.company_id
  WHERE c.city IS DISTINCT FROM U&'Mau\00E9s';

  SELECT COUNT(*) INTO import_history_rows FROM cadastur_imports;
  SELECT COUNT(*) INTO committed_import_rows
  FROM cadastur_imports
  WHERE status = 'committed';
  SELECT COUNT(*) INTO import_payload_rows
  FROM cadastur_imports
  WHERE payload IS NOT NULL;

  SELECT COUNT(*) INTO outside_catalog_rows
  FROM catalog_items
  WHERE city IS DISTINCT FROM U&'Mau\00E9s';

  SELECT COUNT(*) INTO outside_company_rows
  FROM companies
  WHERE city IS DISTINCT FROM U&'Mau\00E9s';

  SELECT COUNT(*) INTO outside_tour_rows
  FROM tours
  WHERE city IS DISTINCT FROM U&'Mau\00E9s';

  IF maues_rows <> 42
    OR outside_rows <> 2679
    OR linked_rows <> 0
    OR outside_guide_rows <> 0
    OR import_history_rows <> 6
    OR committed_import_rows <> 6
    OR import_payload_rows <> 0
    OR outside_catalog_rows <> 0
    OR outside_company_rows <> 0
    OR outside_tour_rows <> 0 THEN
    RAISE EXCEPTION
      'Preflight diverged: Maués %, Cadastur outside %, linked %, non-Maués/unknown guides %, import history %, committed imports %, import payload rows %, catalog outside %, companies outside %, tours outside %; no rows deleted',
      maues_rows, outside_rows, linked_rows, outside_guide_rows, import_history_rows,
      committed_import_rows, import_payload_rows, outside_catalog_rows,
      outside_company_rows, outside_tour_rows;
  END IF;

  DELETE FROM cadastur_entries
  WHERE city IS DISTINCT FROM U&'Mau\00E9s';
  GET DIAGNOSTICS deleted_rows = ROW_COUNT;

  SELECT COUNT(*) INTO remaining_outside_rows
  FROM cadastur_entries
  WHERE city IS DISTINCT FROM U&'Mau\00E9s';

  SELECT COUNT(*) INTO maues_rows
  FROM cadastur_entries
  WHERE city = U&'Mau\00E9s';

  SELECT COUNT(*) INTO remaining_import_history_rows FROM cadastur_imports;
  SELECT COUNT(*) INTO remaining_committed_import_rows
  FROM cadastur_imports
  WHERE status = 'committed';
  SELECT COUNT(*) INTO remaining_import_payload_rows
  FROM cadastur_imports
  WHERE payload IS NOT NULL;

  IF deleted_rows <> 2679
    OR remaining_outside_rows <> 0
    OR maues_rows <> 42
    OR remaining_import_history_rows <> import_history_rows
    OR remaining_committed_import_rows <> committed_import_rows
    OR remaining_import_payload_rows <> 0 THEN
    RAISE EXCEPTION
      'Postflight diverged: deleted %, Maués remaining %, non-Maués remaining %, import history before/after %/%, committed imports before/after %/%, import payload rows %; transaction rolled back',
      deleted_rows, maues_rows, remaining_outside_rows, import_history_rows,
      remaining_import_history_rows, committed_import_rows,
      remaining_committed_import_rows, remaining_import_payload_rows;
  END IF;
END
$maues_cleanup$;

COMMIT;
