-- ============================================================
-- Security Fixes for scarepark-queue (control.immersivecore.network)
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── C4: Enable RLS on all tables ──
-- Ensures data access is enforced at the database level,
-- not just client-side auth checks.

-- attractions: authenticated users can read, only admins can write
ALTER TABLE attractions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read attractions" ON attractions;
CREATE POLICY "Authenticated users can read attractions"
  ON attractions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can modify attractions" ON attractions;
CREATE POLICY "Admins can modify attractions"
  ON attractions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.email = auth.jwt()->>'email'
        AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.email = auth.jwt()->>'email'
        AND user_roles.role = 'admin'
    )
  );


-- park_settings: authenticated can read, admins can write
ALTER TABLE park_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read settings" ON park_settings;
CREATE POLICY "Authenticated users can read settings"
  ON park_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can modify settings" ON park_settings;
CREATE POLICY "Admins can modify settings"
  ON park_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.email = auth.jwt()->>'email'
        AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.email = auth.jwt()->>'email'
        AND user_roles.role = 'admin'
    )
  );


-- ── H6: RLS on status logs and throughput logs ──

-- attraction_status_logs: authenticated can read, admins + supervisors can insert
ALTER TABLE attraction_status_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read status logs" ON attraction_status_logs;
CREATE POLICY "Authenticated users can read status logs"
  ON attraction_status_logs FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Staff can insert status logs" ON attraction_status_logs;
CREATE POLICY "Staff can insert status logs"
  ON attraction_status_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.email = auth.jwt()->>'email'
        AND user_roles.role IN ('admin', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "Admins can update status logs" ON attraction_status_logs;
CREATE POLICY "Admins can update status logs"
  ON attraction_status_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.email = auth.jwt()->>'email'
        AND user_roles.role IN ('admin', 'supervisor')
    )
  );


-- throughput_logs: authenticated can read, admins + supervisors can write
ALTER TABLE throughput_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read throughput logs" ON throughput_logs;
CREATE POLICY "Authenticated users can read throughput logs"
  ON throughput_logs FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Staff can manage throughput logs" ON throughput_logs;
CREATE POLICY "Staff can manage throughput logs"
  ON throughput_logs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.email = auth.jwt()->>'email'
        AND user_roles.role IN ('admin', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.email = auth.jwt()->>'email'
        AND user_roles.role IN ('admin', 'supervisor')
    )
  );


-- audit_logs: only admins can read, authenticated can insert
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read audit logs" ON audit_logs;
CREATE POLICY "Admins can read audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.email = auth.jwt()->>'email'
        AND user_roles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON audit_logs;
CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- signoff_sections: authenticated can read, admins can manage
ALTER TABLE signoff_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read signoff sections" ON signoff_sections;
CREATE POLICY "Authenticated users can read signoff sections"
  ON signoff_sections FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage signoff sections" ON signoff_sections;
CREATE POLICY "Admins can manage signoff sections"
  ON signoff_sections FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.email = auth.jwt()->>'email'
        AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.email = auth.jwt()->>'email'
        AND user_roles.role = 'admin'
    )
  );


-- signoff_completions: authenticated can read + insert
ALTER TABLE signoff_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read signoff completions" ON signoff_completions;
CREATE POLICY "Authenticated users can read signoff completions"
  ON signoff_completions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert signoff completions" ON signoff_completions;
CREATE POLICY "Authenticated users can insert signoff completions"
  ON signoff_completions FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- signoff_pins: authenticated can read (needed for PIN verification)
ALTER TABLE signoff_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read signoff pins" ON signoff_pins;
CREATE POLICY "Authenticated users can read signoff pins"
  ON signoff_pins FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage signoff pins" ON signoff_pins;
CREATE POLICY "Admins can manage signoff pins"
  ON signoff_pins FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.email = auth.jwt()->>'email'
        AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.email = auth.jwt()->>'email'
        AND user_roles.role = 'admin'
    )
  );


-- signoff_checklist_items: authenticated can read, admins can manage
ALTER TABLE signoff_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read checklist items" ON signoff_checklist_items;
CREATE POLICY "Authenticated users can read checklist items"
  ON signoff_checklist_items FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage checklist items" ON signoff_checklist_items;
CREATE POLICY "Admins can manage checklist items"
  ON signoff_checklist_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.email = auth.jwt()->>'email'
        AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.email = auth.jwt()->>'email'
        AND user_roles.role = 'admin'
    )
  );


-- user_roles: admins can read/manage, users can read their own
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own role" ON user_roles;
CREATE POLICY "Users can read their own role"
  ON user_roles FOR SELECT
  TO authenticated
  USING (email = auth.jwt()->>'email');

DROP POLICY IF EXISTS "Admins can read all user roles" ON user_roles;
CREATE POLICY "Admins can read all user roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.email = auth.jwt()->>'email'
        AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;
CREATE POLICY "Admins can manage user roles"
  ON user_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.email = auth.jwt()->>'email'
        AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.email = auth.jwt()->>'email'
        AND ur.role = 'admin'
    )
  );


-- show_reports: authenticated can read, supervisors + admins can write
ALTER TABLE show_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read show reports" ON show_reports;
CREATE POLICY "Authenticated users can read show reports"
  ON show_reports FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Staff can manage show reports" ON show_reports;
CREATE POLICY "Staff can manage show reports"
  ON show_reports FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.email = auth.jwt()->>'email'
        AND user_roles.role IN ('admin', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.email = auth.jwt()->>'email'
        AND user_roles.role IN ('admin', 'supervisor')
    )
  );


-- ── M6: Database-level constraints on numeric fields ──

ALTER TABLE attractions
  DROP CONSTRAINT IF EXISTS attractions_wait_time_range;
ALTER TABLE attractions
  ADD CONSTRAINT attractions_wait_time_range
  CHECK (wait_time >= 0 AND wait_time <= 300);

ALTER TABLE throughput_logs
  DROP CONSTRAINT IF EXISTS throughput_logs_guest_count_range;
ALTER TABLE throughput_logs
  ADD CONSTRAINT throughput_logs_guest_count_range
  CHECK (guest_count >= 0 AND guest_count <= 99999);


-- ── C5: PIN attempt rate limiting ──
-- Create a table to track PIN verification attempts for rate limiting.
-- The application should check this before verifying PINs.

CREATE TABLE IF NOT EXISTS pin_attempts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address text NOT NULL DEFAULT 'unknown',
  attempted_at timestamptz DEFAULT now(),
  success boolean DEFAULT false
);

ALTER TABLE pin_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert pin attempts" ON pin_attempts;
CREATE POLICY "Anyone can insert pin attempts"
  ON pin_attempts FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read pin attempts" ON pin_attempts;
CREATE POLICY "Admins can read pin attempts"
  ON pin_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.email = auth.jwt()->>'email'
        AND user_roles.role = 'admin'
    )
  );

-- Auto-clean old attempts (keep 24 hours only)
-- This can be run as a cron job or Supabase scheduled function
-- DELETE FROM pin_attempts WHERE attempted_at < now() - interval '24 hours';


-- ── C3: Fix privilege escalation via signup metadata ──
-- Replace the handle_new_user trigger to never trust user-provided role.
-- IMPORTANT: Review your existing trigger before running this.

-- CREATE OR REPLACE FUNCTION public.handle_new_user()
-- RETURNS trigger AS $$
-- BEGIN
--   INSERT INTO public.user_roles (email, role)
--   VALUES (NEW.email, 'staff');  -- Always default to 'staff', never read from metadata
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
