-- Maze zones for the Monitor app — sourced from each attraction's CoSWP
-- (section 11.0 Floorplan & Locations + 13.2 E-Stop Locations).

CREATE TABLE IF NOT EXISTS maze_zones (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  attraction_id uuid NOT NULL REFERENCES attractions(id) ON DELETE CASCADE,
  zone_number int,                        -- NULL for non-zone rows (e.g. accessible bypass)
  slug text NOT NULL,                     -- stable key the floorplan art references
  name text NOT NULL,
  level int NOT NULL DEFAULT 0,           -- 0 = ground / broadcast level, -1 = underground
  sort_order int NOT NULL DEFAULT 0,
  is_entrance boolean NOT NULL DEFAULT false,
  is_exit boolean NOT NULL DEFAULT false,
  is_bypass boolean NOT NULL DEFAULT false,
  has_estop boolean NOT NULL DEFAULT false,
  has_break_glass boolean NOT NULL DEFAULT false,
  extinguishers text[] NOT NULL DEFAULT '{}',  -- 'water' | 'co2' | 'foam' | 'fire' (type unspecified in CoSWP)
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (attraction_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_maze_zones_attraction_id ON maze_zones(attraction_id);

ALTER TABLE maze_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read maze_zones"
  ON maze_zones FOR SELECT USING (auth.uid() IS NOT NULL);

-- ── Night Terrors (2026:NightTerrors:CoSWP v25.1) ─────────────────────────────
WITH a AS (SELECT id FROM attractions WHERE slug = 'night-terrors')
INSERT INTO maze_zones (attraction_id, zone_number, slug, name, level, sort_order, is_entrance, is_exit, is_bypass, has_estop, has_break_glass, extinguishers, notes)
SELECT a.id, v.* FROM a, (VALUES
  (1, 'sleep-lab',          'The Experimental Sleep Lab', 0, 1, true,  false, false, true,  true,  ARRAY['co2'],          'Maze entrance — Host Position 2'),
  (2, 'looping-staircase',  'The Looping Staircase',      0, 2, false, false, false, false, false, ARRAY[]::text[],       'Sloped — bypassed by accessible route'),
  (3, 'sluggish-quagmire',  'The Sluggish Quagmire',      0, 3, false, false, false, true,  true,  ARRAY[]::text[],       'Soft floor — bypassed by accessible route'),
  (4, 'shadow-gallery',     'The Shadow Gallery',         0, 4, false, false, false, false, false, ARRAY['co2'],          NULL),
  (5, 'fragmentation-zone', 'The Fragmentation Zone',     0, 5, false, false, false, true,  true,  ARRAY['co2'],          'Strobe-lit'),
  (6, 'erasure-void',       'The Erasure Void',           0, 6, false, true,  false, true,  true,  ARRAY['water','co2'],  'Exit — control booth & Host Position 3'),
  (NULL, 'accessible-bypass', 'Accessible Bypass',        0, 7, false, false, true,  true,  false, ARRAY[]::text[],       'Links Zone 1 to Zone 4')
) AS v(zone_number, slug, name, level, sort_order, is_entrance, is_exit, is_bypass, has_estop, has_break_glass, extinguishers, notes);

-- ── Signal Loss (2026:SignalLoss:CoSWP) ───────────────────────────────────────
WITH a AS (SELECT id FROM attractions WHERE slug = 'signal-loss')
INSERT INTO maze_zones (attraction_id, zone_number, slug, name, level, sort_order, is_entrance, is_exit, is_bypass, has_estop, has_break_glass, extinguishers, notes)
SELECT a.id, v.* FROM a, (VALUES
  (1, 'foyer-checkpoint',  'Foyer & Security Checkpoint', 0, 1, true,  false, false, true,  true,  ARRAY['water'],       'Hand-torches stationed at every E-Stop point'),
  (2, 'server-corridors',  'Server Corridors',            0, 2, false, false, false, true,  true,  ARRAY['co2'],         'Sub-zero ambient temperature'),
  (3, 'diagnostics-lab',   'Diagnostics Lab',             0, 3, false, false, false, false, false, ARRAY['co2'],         'Live CRT monitors & broadcast cabling'),
  (4, 'anechoic-chamber',  'Anechoic Chamber',            0, 4, false, false, false, true,  true,  ARRAY[]::text[],      'Room deadens shouted instructions — count groups through'),
  (5, 'transmission-feed', 'Transmission Feed',           0, 5, false, false, false, true,  false, ARRAY['co2'],         'Stacked-monitor tunnel — walked single file'),
  (6, 'broadcast-core',    'Broadcast Core',              0, 6, false, true,  false, true,  true,  ARRAY['water'],       'Exit')
) AS v(zone_number, slug, name, level, sort_order, is_entrance, is_exit, is_bypass, has_estop, has_break_glass, extinguishers, notes);

-- ── Strings of Control (2026:StringsOfControl:CoSWP) ──────────────────────────
WITH a AS (SELECT id FROM attractions WHERE slug = 'strings-of-control')
INSERT INTO maze_zones (attraction_id, zone_number, slug, name, level, sort_order, is_entrance, is_exit, is_bypass, has_estop, has_break_glass, extinguishers, notes)
SELECT a.id, v.* FROM a, (VALUES
  (1, 'rotting-vestibule', 'The Rotting Vestibule',  0, 1, true,  false, false, true,  true,  ARRAY['water','co2'], 'Maze entrance'),
  (2, 'sawdust-sizing',    'Sawdust & Sizing Room',  0, 2, false, false, false, true,  true,  ARRAY['water'],       'Puppet workshop set — dry timber & sawdust'),
  (3, 'articulation-ward', 'The Articulation Ward',  0, 3, false, false, false, false, false, ARRAY['co2'],         NULL),
  (4, 'tangled-rigging',   'The Tangled Rigging',    0, 4, false, false, false, true,  true,  ARRAY[]::text[],      'Low-visibility hanging-string maze — lead guests by hand on evac'),
  (5, 'varnish-vats',      'Varnish & Paint Vats',   0, 5, false, false, false, true,  false, ARRAY['foam','co2'],  'Flammable liquids — foam extinguisher'),
  (6, 'masters-stage',     'The Master''s Stage',    0, 6, false, true,  false, true,  true,  ARRAY['water','co2'], 'Exit — overhead rig & bungee drops; no fly effects during evac')
) AS v(zone_number, slug, name, level, sort_order, is_entrance, is_exit, is_bypass, has_estop, has_break_glass, extinguishers, notes);

-- ── The Bunker (2025:TheBunker:CoSWP) ─────────────────────────────────────────
WITH a AS (SELECT id FROM attractions WHERE slug = 'the-bunker')
INSERT INTO maze_zones (attraction_id, zone_number, slug, name, level, sort_order, is_entrance, is_exit, is_bypass, has_estop, has_break_glass, extinguishers, notes)
SELECT a.id, v.* FROM a, (VALUES
  (1, 'entrance-hall',  'Entrance Hall',  0, 1, true,  false, false, true,  true,  ARRAY['fire'],   'Maze entrance'),
  (2, 'hallways',       'Hallways',       0, 2, false, false, false, false, false, ARRAY[]::text[], NULL),
  (3, 'dining-room',    'Dining Room',    0, 3, false, false, false, true,  false, ARRAY['fire'],   NULL),
  (4, 'nursery',        'Nursery',        0, 4, false, false, false, false, false, ARRAY[]::text[], 'Nursery performers confirm section clear on evac'),
  (5, 'allotment',      'Allotment',      0, 5, false, false, false, true,  true,  ARRAY['fire'],   NULL),
  (6, 'armoury',        'Armoury',        0, 6, false, false, false, true,  false, ARRAY[]::text[], NULL),
  (7, 'outsiders',      'Outsiders',      0, 7, false, false, false, false, false, ARRAY[]::text[], NULL),
  (8, 'hunting-ground', 'Hunting Ground', 0, 8, false, true,  false, true,  true,  ARRAY['fire'],   'Exit')
) AS v(zone_number, slug, name, level, sort_order, is_entrance, is_exit, is_bypass, has_estop, has_break_glass, extinguishers, notes);

-- ── Westlake Witch Trials (2025:WestlakeWitchTrials:CoSWP) ────────────────────
WITH a AS (SELECT id FROM attractions WHERE slug = 'westlake-witch-trials')
INSERT INTO maze_zones (attraction_id, zone_number, slug, name, level, sort_order, is_entrance, is_exit, is_bypass, has_estop, has_break_glass, extinguishers, notes)
SELECT a.id, v.* FROM a, (VALUES
  (1, 'holding-cages',        'Green Room & Holding Cages', 0,  1, true,  false, false, true,  true,  ARRAY['fire'],   'Maze entrance — broadcast set'),
  (2, 'broadcast-courtroom',  'Broadcast Courtroom',        0,  2, false, false, false, true,  true,  ARRAY[]::text[], NULL),
  (3, 'dunking-gallows',      'Dunking Stool & Gallows',    0,  3, false, false, false, true,  false, ARRAY['fire'],   NULL),
  (4, 'synthetic-graveyard',  'Synthetic Graveyard',        0,  4, false, false, false, false, false, ARRAY[]::text[], 'Descent point to lower level — staircase is the only route between levels'),
  (5, 'witches-underground',  'Witches'' Underground',      -1, 5, false, false, false, true,  true,  ARRAY[]::text[], 'Lower level'),
  (6, 'neon-coven',           'Neon Coven',                 -1, 6, false, true,  false, true,  true,  ARRAY['fire'],   'Exit — lower level')
) AS v(zone_number, slug, name, level, sort_order, is_entrance, is_exit, is_bypass, has_estop, has_break_glass, extinguishers, notes);
