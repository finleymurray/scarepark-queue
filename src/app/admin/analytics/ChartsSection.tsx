'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceArea,
  BarChart, Bar, ComposedChart,
} from 'recharts';
import {
  LINE_COLORS, STATUS_BAND_COLORS, CHART_TOOLTIP_STYLE,
  AXIS_TICK_STYLE, GRID_STROKE, formatTimeShort,
} from './chartTheme';
import type { StatusPeriod } from './chartTheme';

type TooltipStyle = typeof CHART_TOOLTIP_STYLE;

/* ── Season: guests per night ── */
export function SeasonPerNightChart({
  data, tooltipStyle,
}: {
  data: { date: string; label: string; guests: number }[];
  tooltipStyle: TooltipStyle;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis dataKey="label" stroke="transparent" tick={AXIS_TICK_STYLE} angle={-30} textAnchor="end" height={60} interval="preserveStartEnd" />
        <YAxis
          stroke="transparent"
          tick={AXIS_TICK_STYLE}
          label={{ value: 'Guests', angle: -90, position: 'insideLeft', fill: '#475569', style: { fontSize: 11 } }}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toLocaleString(), 'Guests']} />
        <Bar dataKey="guests" fill={LINE_COLORS[1]} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Season: busiest hours ── */
export function SeasonByHourChart({
  data, tooltipStyle,
}: {
  data: { slot_start: string; label: string; guests: number }[];
  tooltipStyle: TooltipStyle;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis dataKey="label" stroke="transparent" tick={AXIS_TICK_STYLE} />
        <YAxis
          stroke="transparent"
          tick={AXIS_TICK_STYLE}
          label={{ value: 'Guests', angle: -90, position: 'insideLeft', fill: '#475569', style: { fontSize: 11 } }}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toLocaleString(), 'Guests']} />
        <Bar dataKey="guests" fill={LINE_COLORS[4]} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Queue Times: wait time line chart ── */
export function WaitTimesChart({
  chartData, statusPeriods, attractionNames, tooltipStyle,
}: {
  chartData: Record<string, number | string | null>[];
  statusPeriods: StatusPeriod[];
  attractionNames: string[];
  tooltipStyle: TooltipStyle;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        {statusPeriods.map((period, i) => (
          <ReferenceArea
            key={`${period.attractionName}-${period.start}-${i}`}
            x1={period.start}
            x2={period.end}
            fill={STATUS_BAND_COLORS[period.status] || '#ffffff10'}
            fillOpacity={1}
            strokeOpacity={0}
          />
        ))}
        <XAxis
          dataKey="time"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(ts) => formatTimeShort(Number(ts))}
          stroke="transparent"
          tick={AXIS_TICK_STYLE}
        />
        <YAxis
          stroke="transparent"
          tick={AXIS_TICK_STYLE}
          label={{
            value: 'Wait (min)',
            angle: -90,
            position: 'insideLeft',
            fill: '#475569',
            style: { fontSize: 11 },
          }}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(ts) => formatTimeShort(Number(ts))}
          formatter={(value, name) => {
            if (value === null || value === undefined) return ['--', name];
            return [`${value} min`, name];
          }}
        />
        <Legend wrapperStyle={{ color: '#94A3B8', fontSize: 12, paddingTop: 12 }} />
        {attractionNames.map((name, i) => (
          <Line
            key={name}
            type="monotone"
            dataKey={name}
            stroke={LINE_COLORS[i % LINE_COLORS.length]}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── Throughput: bar chart ── */
export function ThroughputBarChart({
  data, names, tooltipStyle,
}: {
  data: Record<string, string | number>[];
  names: string[];
  tooltipStyle: TooltipStyle;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis
          dataKey="slot"
          stroke="transparent"
          tick={AXIS_TICK_STYLE}
          angle={-30}
          textAnchor="end"
          height={60}
        />
        <YAxis
          stroke="transparent"
          tick={AXIS_TICK_STYLE}
          label={{
            value: 'Guests',
            angle: -90,
            position: 'insideLeft',
            fill: '#475569',
            style: { fontSize: 11 },
          }}
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ color: '#94A3B8', fontSize: 12, paddingTop: 12 }} />
        {names.map((name, i) => (
          <Bar
            key={name}
            dataKey={name}
            fill={LINE_COLORS[i % LINE_COLORS.length]}
            radius={[3, 3, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Throughput: combined wait time vs throughput chart ── */
export function CombinedChart({
  data, names, tooltipStyle,
}: {
  data: Record<string, string | number>[];
  names: string[];
  tooltipStyle: TooltipStyle;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis
          dataKey="slot"
          stroke="transparent"
          tick={AXIS_TICK_STYLE}
          angle={-30}
          textAnchor="end"
          height={60}
        />
        <YAxis
          yAxisId="left"
          stroke="transparent"
          tick={AXIS_TICK_STYLE}
          label={{
            value: 'Wait (min)',
            angle: -90,
            position: 'insideLeft',
            fill: '#475569',
            style: { fontSize: 11 },
          }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="transparent"
          tick={AXIS_TICK_STYLE}
          label={{
            value: 'Guests',
            angle: 90,
            position: 'insideRight',
            fill: '#475569',
            style: { fontSize: 11 },
          }}
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ color: '#94A3B8', fontSize: 12, paddingTop: 12 }} />
        {names.map((name, i) => (
          <Bar
            key={`bar-${name}`}
            yAxisId="right"
            dataKey={`${name} (guests)`}
            fill={LINE_COLORS[i % LINE_COLORS.length]}
            fillOpacity={0.35}
            radius={[2, 2, 0, 0]}
          />
        ))}
        {names.map((name, i) => (
          <Line
            key={`line-${name}`}
            yAxisId="left"
            type="monotone"
            dataKey={`${name} (wait)`}
            stroke={LINE_COLORS[i % LINE_COLORS.length]}
            strokeWidth={2.5}
            dot={{ r: 3, fill: LINE_COLORS[i % LINE_COLORS.length] }}
            connectNulls={false}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
