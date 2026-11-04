CREATE INDEX cadastur_public_path_ids
  ON cadastur_entries(category,id)
  WHERE published=1 AND review_status='reviewed' AND uf='AM';

CREATE INDEX catalog_public_hub_path_ids
  ON catalog_items(id)
  WHERE status='published' AND source_entry_id IS NULL;
