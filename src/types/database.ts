export type AttractionStatus = 'OPEN' | 'CLOSED' | 'DELAYED' | 'AT CAPACITY';

export type AttractionType = 'ride' | 'show';

export interface Attraction {
  id: string;
  name: string;
  slug: string;
  status: AttractionStatus;
  wait_time: number;
  sort_order: number;
  attraction_type: AttractionType;
  show_times: string[] | null;
  updated_at: string;
  target_dispatch_seconds?: number | null;
  // Asset + theming (uploaded via the new-attraction wizard; null = use hardcoded fallback)
  logo_url?: string | null;
  bg_url?: string | null;
  queue_bg_url?: string | null;
  glow_rgb?: string | null;
  text_color?: string | null;
  text_rgb?: string | null;
  tagline?: string | null;
}

export interface DispatchLog {
  id: string;
  attraction_id: string;
  group_size: number;
  dispatched_at: string;
  dispatched_by: string;
  log_date: string;
}

export interface OperatorSession {
  id: string;
  attraction_id: string;
  user_id: string | null;
  operator_name: string;
  operator_email: string | null;
  started_at: string;
  ended_at: string | null;
  ended_reason: 'logout' | 'takeover' | 'auto' | null;
  log_date: string;
}

export type IncidentSource = 'operator' | 'delay_auto' | 'admin_request';
export type IncidentStatus = 'requested' | 'submitted' | 'dismissed' | 'reviewed';
export type IncidentSeverity = 'minor' | 'moderate' | 'serious';
export type IncidentCategory =
  | 'Injury'
  | 'Guest behaviour'
  | 'Ejection'
  | 'Near miss'
  | 'Lost child'
  | 'Technical'
  | 'Other';

export type IncidentType = 'operational' | 'injury';

export interface Incident {
  id: string;
  attraction_id: string | null;
  attraction_name: string;
  log_date: string;
  source: IncidentSource;
  status: IncidentStatus;
  incident_type: IncidentType;
  form_data: Record<string, unknown>;
  severity: IncidentSeverity | null;
  category: string | null;
  description: string | null;
  people_involved: string | null;
  actions_taken: string | null;
  reported_by: string | null;
  requested_by: string | null;
  delay_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParkSetting {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

export interface AttractionHistory {
  id: string;
  attraction_id: string;
  attraction_name: string;
  status: AttractionStatus;
  wait_time: number;
  recorded_at: string;
}

export interface ThroughputLog {
  id: string;
  attraction_id: string;
  slot_start: string;
  slot_end: string;
  guest_count: number;
  logged_by: string;
  log_date: string;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  email: string;
  display_name: string | null;
  role: 'admin' | 'supervisor';
  allowed_attractions: string[] | null;
  created_at: string;
  updated_at: string;
}

export type AuditActionType = 'queue_time_change' | 'status_change' | 'throughput_entry' | 'show_time_added' | 'show_time_removed' | 'attraction_created' | 'attraction_deleted' | 'signoff_completion' | 'show_report_submission' | 'operator_login' | 'operator_logout';

export interface AuditLog {
  id: string;
  action_type: AuditActionType;
  attraction_id: string | null;
  attraction_name: string;
  performed_by: string;
  old_value: string | null;
  new_value: string | null;
  details: string | null;
  created_at: string;
}

/* ── Screen Monitoring ── */

export interface ScreenHeartbeat {
  screen_id: string;
  page: string;
  last_seen: string;
  user_agent: string | null;
}

/* ── Screen Controller ── */

export interface Screen {
  id: string;
  code: string;
  assigned_path: string | null;
  current_page: string | null;
  name: string | null;
  label: string | null;
  last_seen: string;
  user_agent: string | null;
  created_at: string;
}

/* ── Sign-Off System ── */

export type SignoffRoleKey = 'supervisor' | 'show_captain' | 'construction' | 'tech' | 'manager';

export interface SignoffPin {
  id: string;
  user_id: string;
  pin: string;
  signoff_roles: SignoffRoleKey[];
  created_at: string;
  updated_at: string;
}

export interface SignoffSection {
  id: string;
  attraction_id: string;
  name: string;
  role_key: SignoffRoleKey;
  phase: 'opening' | 'closing';
  sort_order: number;
  requires_all_complete: boolean;
  created_at: string;
}

export interface SignoffChecklistItem {
  id: string;
  section_id: string;
  label: string;
  sort_order: number;
}

export interface SignoffCompletion {
  id: string;
  section_id: string;
  attraction_id: string;
  sign_date: string;
  signed_by_name: string;
  signed_by_email: string;
  signed_at: string;
}

/* ── Status Timeline System ── */

export type DelayReason =
  | 'Technical Issue'
  | 'Guest Action'
  | 'E-Stop'
  | 'Weather'
  | 'Staffing'
  | 'Other';

export interface AttractionStatusLog {
  id: string;
  attraction_id: string;
  status: AttractionStatus;
  previous_status: AttractionStatus | null;
  reason: DelayReason | null;
  notes: string | null;
  changed_by: string;
  changed_at: string;
  resolved_at: string | null;
}

/* ── Show Report System ── */

export interface HourlyThroughputSnapshot {
  slot_start: string;
  slot_end: string;
  guest_count: number;
}

export interface DelaySnapshot {
  reason: string | null;
  notes: string | null;
  started_at: string;
  resolved_at: string | null;
  duration_minutes: number | null;
}

export interface ShowReport {
  id: string;
  attraction_id: string;
  report_date: string;
  total_operating_minutes: number;
  total_guests: number;
  hourly_throughput: HourlyThroughputSnapshot[];
  delays: DelaySnapshot[];
  operational_report: string | null;
  technical_report: string | null;
  costume_report: string | null;
  construction_report: string | null;
  additional_notes: string | null;
  signature: string | null;
  submitted_by_email: string;
  submitted_by_name: string;
  is_draft: boolean;
  draft_updated_at: string | null;
  created_at: string;
}
