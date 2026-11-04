CREATE INDEX tours_public_catalog_order
  ON tours(name,id)
  WHERE published=1;
