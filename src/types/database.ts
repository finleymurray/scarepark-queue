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
