-- Dispatch logs: track every group sent into an attraction
CREATE TABLE IF NOT EXISTS dispatch_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attraction_id UUID REFERENCES attractions(id) ON DELETE CASCADE,
  group_size INTEGER NOT NULL DEFAULT 1,
  dispatched_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  dispatched_by TEXT NOT NULL,
  log_date DATE GENERATED ALWAYS AS (dispatched_at::date) STORED
);

CREATE INDEX IF NOT EXISTS dispatch_logs_attraction_date
  ON dispatch_logs(attraction_id, log_date);

-- Target dispatch interval per attraction (seconds, default 90s)
ALTER TABLE attractions
  ADD COLUMN IF NOT EXISTS target_dispatch_seconds INTEGER DEFAULT 90;
