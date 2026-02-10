-- Add display_name to user_roles
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS display_name text;

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type text NOT NULL,
  attraction_id uuid REFERENCES attractions(id) ON DELETE SET NULL,
  attraction_name text NOT NULL,
  performed_by text NOT NULL,
  old_value text,
  new_value text,
  details text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_attraction_id ON audit_logs(attraction_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated read audit_logs"
  ON audit_logs FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated insert audit_logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
