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

export type AuditActionType = 'queue_time_change' | 'status_change' | 'throughput_entry';

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
