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

-- 8. Seed the closing time setting
INSERT INTO park_settings (key, value) VALUES
  ('closing_time', '22:00');

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
