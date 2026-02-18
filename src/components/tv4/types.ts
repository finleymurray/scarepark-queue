import type { Attraction } from '@/types/database';

export interface TV4ContentProps {
  /** Rides only (attraction_type !== 'show'), already sorted */
  rides: Attraction[];
  /** Shows only (attraction_type === 'show') */
  shows: Attraction[];
  /** Park closing time string e.g. "22:00" */
  closingTime: string;
  /** Whether this slide is currently the visible one in the carousel */
  isActive: boolean;
  /** Current timestamp, updated every 30s, for show time calculations */
  now: number;
}
