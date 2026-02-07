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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE attractions ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policy: Anyone can read (for the public TV display)
CREATE POLICY "Allow public read access"
  ON attractions
  FOR SELECT
  USING (true);

-- 4. RLS Policy: Only authenticated users can update (staff)
CREATE POLICY "Allow authenticated update"
  ON attractions
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- 5. Enable Realtime on this table
ALTER PUBLICATION supabase_realtime ADD TABLE attractions;

-- 6. Seed the 5 attractions
INSERT INTO attractions (name, slug, status, wait_time, sort_order) VALUES
  ('Night Terrors',          'night-terrors',          'CLOSED', 0, 1),
  ('Westlake Witch Trials',  'westlake-witch-trials',  'CLOSED', 0, 2),
  ('The Bunker',             'the-bunker',             'CLOSED', 0, 3),
  ('Strings of Control',     'strings-of-control',     'CLOSED', 0, 4),
  ('Drowned',                'drowned',                'CLOSED', 0, 5);
