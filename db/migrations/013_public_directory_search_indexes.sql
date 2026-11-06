CREATE INDEX cadastur_public_directory_search
  ON cadastur_entries(category,city,subtype,name,id)
  WHERE published=1 AND review_status='reviewed' AND uf='AM';

CREATE INDEX catalog_public_directory_search
  ON catalog_items(category,city,subtype,name,id)
  WHERE status='published' AND source_entry_id IS NULL;
