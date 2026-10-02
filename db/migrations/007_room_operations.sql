ALTER TABLE rooms
ADD COLUMN operational_status TEXT NOT NULL DEFAULT 'ready'
CHECK(operational_status IN ('ready','cleaning','maintenance'));
