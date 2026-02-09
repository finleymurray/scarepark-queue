-- ============================================
-- Scarepark Queue Management System
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. Create the attractions table
CREATE TABLE IF NOT EXISTS attractions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'CLOSED',
  wait_time INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL,
  attraction_type TEXT NOT NULL DEFAULT 'ride',
  show_times JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create park_settings table (for closing time, etc.)
CREATE TABLE IF NOT EXISTS park_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable Row Level Security
ALTER TABLE attractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE park_settings ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for attractions
CREATE POLICY "Allow public read access"
  ON attractions FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert"
  ON attractions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated update"
  ON attractions FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated delete"
  ON attractions FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- 5. RLS Policies for park_settings
CREATE POLICY "Allow public read settings"
  ON park_settings FOR SELECT USING (true);

CREATE POLICY "Allow authenticated update settings"
  ON park_settings FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- 6. Enable Realtime on both tables
ALTER PUBLICATION supabase_realtime ADD TABLE attractions;
ALTER PUBLICATION supabase_realtime ADD TABLE park_settings;

-- 7. Seed the 5 attractions
INSERT INTO attractions (name, slug, status, wait_time, sort_order, attraction_type) VALUES
  ('Night Terrors',          'night-terrors',          'CLOSED', 0, 1, 'ride'),
  ('Westlake Witch Trials',  'westlake-witch-trials',  'CLOSED', 0, 2, 'ride'),
  ('The Bunker',             'the-bunker',             'CLOSED', 0, 3, 'ride'),
  ('Strings of Control',     'strings-of-control',     'CLOSED', 0, 4, 'ride'),
  ('Drowned',                'drowned',                'CLOSED', 0, 5, 'ride');

-- 8. Seed the settings
INSERT INTO park_settings (key, value) VALUES
  ('opening_time', '18:00'),
  ('closing_time', '22:00'),
  ('auto_sort_by_wait', 'false');

-- ============================================
-- ANALYTICS: Queue Time History
-- Run this in the Supabase SQL Editor
-- ============================================

-- 9. Create the attraction_history table
CREATE TABLE IF NOT EXISTS attraction_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attraction_id UUID NOT NULL REFERENCES attractions(id) ON DELETE CASCADE,
  attraction_name TEXT NOT NULL,
  status TEXT NOT NULL,
  wait_time INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Create indexes for efficient date-range queries
CREATE INDEX IF NOT EXISTS idx_attraction_history_recorded_at
  ON attraction_history (recorded_at);

CREATE INDEX IF NOT EXISTS idx_attraction_history_attraction_date
  ON attraction_history (attraction_id, recorded_at);

-- 11. Enable RLS on attraction_history
ALTER TABLE attraction_history ENABLE ROW LEVEL SECURITY;

-- 12. RLS Policy — public read (auth gated at UI layer)
CREATE POLICY "Allow public read history"
  ON attraction_history FOR SELECT USING (true);

-- 13. Trigger function to log attraction changes
CREATE OR REPLACE FUNCTION log_attraction_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status)
     OR (OLD.wait_time IS DISTINCT FROM NEW.wait_time) THEN
    INSERT INTO attraction_history (attraction_id, attraction_name, status, wait_time)
    VALUES (NEW.id, NEW.name, NEW.status, NEW.wait_time);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 14. Attach trigger to attractions table
CREATE TRIGGER attraction_change_trigger
  AFTER UPDATE ON attractions
  FOR EACH ROW
  EXECUTE FUNCTION log_attraction_change();

-- ============================================
-- SUPERVISOR: Throughput Logs
-- ============================================

-- 15. Create the throughput_logs table
CREATE TABLE IF NOT EXISTS throughput_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attraction_id UUID NOT NULL REFERENCES attractions(id) ON DELETE CASCADE,
  slot_start TEXT NOT NULL,
  slot_end TEXT NOT NULL,
  guest_count INTEGER NOT NULL DEFAULT 0,
  logged_by TEXT NOT NULL DEFAULT '',
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16. Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_throughput_logs_attraction_date
  ON throughput_logs (attraction_id, created_at);

CREATE INDEX IF NOT EXISTS idx_throughput_logs_created_at
  ON throughput_logs (created_at);

-- 17. Unique constraint: one log per attraction per slot per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_throughput_logs_unique_slot
  ON throughput_logs (attraction_id, slot_start, slot_end, log_date);

-- 18. Enable RLS on throughput_logs
ALTER TABLE throughput_logs ENABLE ROW LEVEL SECURITY;

-- 19. RLS Policies for throughput_logs
CREATE POLICY "Allow public read throughput"
  ON throughput_logs FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert throughput"
  ON throughput_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated update throughput"
  ON throughput_logs FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- 20. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE throughput_logs;

-- 21. RLS Policy for park_settings insert (needed for upsert of opening_time)
CREATE POLICY "Allow authenticated insert settings"
  ON park_settings FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- MIGRATION: Run this if you already have the
-- tables from a previous version
-- ============================================
-- -- Add columns for Live Show support
-- ALTER TABLE attractions ADD COLUMN IF NOT EXISTS attraction_type TEXT NOT NULL DEFAULT 'ride';
-- ALTER TABLE attractions ADD COLUMN IF NOT EXISTS show_times JSONB DEFAULT '[]'::jsonb;
--
-- -- Remove old next_show_time column if it exists
-- ALTER TABLE attractions DROP COLUMN IF EXISTS next_show_time;
--
-- -- Fix RLS policies if add/delete isn't working:
-- DROP POLICY IF EXISTS "Allow authenticated insert" ON attractions;
-- DROP POLICY IF EXISTS "Allow authenticated update" ON attractions;
-- DROP POLICY IF EXISTS "Allow authenticated delete" ON attractions;
-- CREATE POLICY "Allow authenticated insert" ON attractions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- CREATE POLICY "Allow authenticated update" ON attractions FOR UPDATE USING (auth.uid() IS NOT NULL);
-- CREATE POLICY "Allow authenticated delete" ON attractions FOR DELETE USING (auth.uid() IS NOT NULL);
