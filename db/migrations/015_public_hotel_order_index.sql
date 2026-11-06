CREATE INDEX companies_public_hotel_order
  ON companies(COALESCE(NULLIF(TRIM(trade_name),''),name),id)
  WHERE kind='hotel' AND status='published';
