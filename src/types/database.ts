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
  next_show_time: string | null;
  updated_at: string;
}

export interface ParkSetting {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}
