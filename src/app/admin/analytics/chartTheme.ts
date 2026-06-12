import { surface, border, text } from '@/lib/theme';

export const LINE_COLORS = [
  '#22C55E',
  '#3B82F6',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#F97316',
  '#14B8A6',
  '#A855F7',
];

export const STATUS_BAND_COLORS: Record<string, string> = {
  'CLOSED': '#dc354525',
  'DELAYED': '#f0ad4e25',
  'AT CAPACITY': '#F59E0B25',
};

export const STATUS_LABEL_COLORS: Record<string, string> = {
  'CLOSED': '#dc3545',
  'DELAYED': '#f0ad4e',
  'AT CAPACITY': '#F59E0B',
};

export interface StatusPeriod {
  attractionName: string;
  status: string;
  start: number;
  end: number;
}

export function formatTimeShort(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export const CHART_TOOLTIP_STYLE = {
  backgroundColor: surface.card,
  border: `1px solid ${border.default}`,
  borderRadius: '8px',
  color: text.primary,
  fontSize: 12,
};

export const AXIS_TICK_STYLE = { fill: text.faint, fontSize: 11 };
export const GRID_STROKE = border.divider;
