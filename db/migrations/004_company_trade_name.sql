ALTER TABLE companies ADD COLUMN trade_name TEXT NOT NULL DEFAULT ''
  CHECK(trade_name = '' OR length(trim(trade_name)) BETWEEN 2 AND 100);
