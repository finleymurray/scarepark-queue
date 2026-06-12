'use client';

import type { AttractionHistory, AttractionStatusLog } from '@/types/database';
import { surface, border, text, radius, microLabel } from '@/lib/theme';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts';

export interface DelayIncident {
  log: AttractionStatusLog;
  durationSecs: number | null; // null = ongoing
}

/* ── Queue time sparkline ── */

interface ChartPoint { t: number; wait: number | null; label: string } // t = local minutes since midnight

/* Convert "HH:MM" string → minutes since midnight */
function hhmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

/* Convert a live Date → local minutes since midnight */
function dateToMin(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/* Format minutes-since-midnight as "7PM", "9PM" etc for axis ticks */
function formatMinLabel(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}${ampm}`;
}

/* Format minutes-since-midnight as "7:24 PM" for tooltip */
function formatMinTooltip(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function QueueChart({
  history,
  delays,
  dateStr,
  openTime,
  closeTime,
}: {
  history: AttractionHistory[];
  delays: DelayIncident[];
  dateStr: string;
  openTime: string;
  closeTime: string;
}) {
  if (history.length === 0) return null;

  // Use LOCAL minutes-since-midnight to avoid all timezone issues.
  // openTime "19:00" → 1140, closeTime "23:00" → 1380.
  // Data points also converted via d.getHours()/getMinutes() (local).
  let domainStart: number;
  let domainEnd: number;

  if (openTime && closeTime) {
    domainStart = Math.floor(hhmToMin(openTime) / 60) * 60; // floor to hour
    domainEnd   = hhmToMin(closeTime) + 60;                 // +1hr buffer
    if (domainEnd <= domainStart) domainEnd += 24 * 60;     // cross midnight
  } else {
    const mins = history.map((h) => dateToMin(new Date(h.recorded_at)));
    domainStart = Math.floor(Math.min(...mins) / 60) * 60;
    domainEnd   = Math.ceil(Math.max(...mins)  / 60) * 60 + 60;
  }

  // Only include history records within the operating window —
  // early-morning records (status checks etc) would otherwise push
  // dataMin far left of 7PM and squish all the useful data to the right.
  const dataPoints: ChartPoint[] = history
    .filter((h) => {
      const min = dateToMin(new Date(h.recorded_at));
      return min >= domainStart && min <= domainEnd;
    })
    .map((h) => {
      const d = new Date(h.recorded_at);
      const min = dateToMin(d);
      return {
        t: min,
        wait: h.status === 'OPEN' || h.status === 'AT CAPACITY' ? h.wait_time : null,
        label: formatMinTooltip(min),
      };
    });

  // Boundary points at exactly domainStart and domainEnd anchor the chart
  // to the full operating window. With no out-of-window data, dataMin/dataMax
  // will be exactly domainStart and domainEnd.
  const points: ChartPoint[] = [
    { t: domainStart, wait: null, label: formatMinTooltip(domainStart) },
    ...dataPoints,
    { t: domainEnd,   wait: null, label: formatMinTooltip(domainEnd) },
  ];

  if (points.length < 2) return null;

  // Delay reference lines in local minutes
  const delayBands = delays.map((d) => ({
    start: dateToMin(new Date(d.log.changed_at)),
    end:   d.log.resolved_at ? dateToMin(new Date(d.log.resolved_at)) : dateToMin(new Date()),
  }));

  // Hourly ticks — every 2 hours
  const allTicks: number[] = [];
  for (let t = Math.floor(domainStart / 60) * 60; t <= domainEnd; t += 60) allTicks.push(t);
  const ticks = allTicks.filter((_, i) => i % 2 === 0);

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ ...microLabel, marginBottom: 8 }}>
        Queue time tonight
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={points} margin={{ top: 10, right: 12, bottom: 4, left: 36 }}>
          <defs>
            <linearGradient id={`grad-${history[0]?.attraction_id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="10%" stopColor="#22C55E" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#22C55E" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={border.divider} vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            ticks={ticks}
            tickFormatter={formatMinLabel}
            tick={{ fontSize: 11, fill: '#475569' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            dataKey="wait"
            tick={{ fontSize: 11, fill: '#475569' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={28}
            tickFormatter={(v) => `${v}m`}
          />
          <Tooltip
            contentStyle={{ background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.sm, fontSize: 13 }}
            labelFormatter={(v) => formatMinTooltip(v as number)}
            formatter={(v: unknown) => [`${v} min`, 'Wait time']}
            itemStyle={{ color: '#22C55E' }}
            labelStyle={{ color: text.muted }}
          />
          {delayBands.map((band, i) => (
            <ReferenceLine
              key={i}
              x={band.start}
              stroke="#f0ad4e"
              strokeWidth={2}
              strokeDasharray="4 3"
              opacity={0.7}
            />
          ))}
          <Area
            type="monotone"
            dataKey="wait"
            stroke="#22C55E"
            strokeWidth={3}
            fill={`url(#grad-${history[0]?.attraction_id})`}
            connectNulls={false}
            dot={{ r: 3, fill: '#22C55E', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#22C55E' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
