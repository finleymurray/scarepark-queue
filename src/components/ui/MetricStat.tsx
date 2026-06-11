'use client';

import { microLabel, text, FONT_NUM } from '@/lib/theme';

/** Micro-label + big number stat, used across Operations/Analytics/Control. */
export default function MetricStat({
  label,
  value,
  color = text.primary,
  size = 20,
  align = 'left',
}: {
  label: string;
  value: string | number;
  color?: string;
  size?: number;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <div style={{ textAlign: align }}>
      <div style={microLabel}>{label}</div>
      <div style={{ color, fontSize: size, fontWeight: 500, marginTop: 2, ...FONT_NUM }}>{value}</div>
    </div>
  );
}
