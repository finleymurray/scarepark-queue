-- Lanyard-based queue timing: scan in at queue entrance, scan out at attraction
-- entry; duration feeds the operator's queue-time control.
CREATE TABLE IF NOT EXISTS queue_timings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attraction_id UUID NOT NULL REFERENCES attractions(id) ON DELETE CASCADE,
  lanyard_code TEXT NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_secs INTEGER,
  started_by TEXT,
  completed_by TEXT,
  voided BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_queue_timings_open
  ON queue_timings (attraction_id, lanyard_code)
  WHERE completed_at IS NULL AND NOT voided;
CREATE INDEX IF NOT EXISTS idx_queue_timings_date
  ON queue_timings (attraction_id, log_date);

ALTER TABLE queue_timings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read queue_timings"
  ON queue_timings FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert queue_timings"
  ON queue_timings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update queue_timings"
  ON queue_timings FOR UPDATE TO authenticated USING (true);
