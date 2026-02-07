'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { AttractionHistory } from '@/types/database';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceArea,
} from 'recharts';

const LINE_COLORS = [
  '#CC0000',
  '#22C55E',
  '#6366F1',
  '#FF8C00',
  '#F59E0B',
  '#EC4899',
  '#06B6D4',
  '#8B5CF6',
  '#EF4444',
  '#14B8A6',
];

const STATUS_BAND_COLORS: Record<string, string> = {
  'CLOSED': '#CC000025',
  'DELAYED': '#FF8C0025',
  'AT CAPACITY': '#F59E0B25',
};

const STATUS_LABEL_COLORS: Record<string, string> = {
  'CLOSED': '#CC0000',
  'DELAYED': '#FF8C00',
  'AT CAPACITY': '#F59E0B',
};

interface StatusPeriod {
  attractionName: string;
  status: string;
  start: number;
  end: number;
}

function getTimeRange(dateStr: string): { start: string; end: string } {
  const start = new Date(`${dateStr}T17:00:00`);
  const end = new Date(`${dateStr}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function formatTimeShort(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState<AttractionHistory[]>([]);
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().split('T')[0]
  );

  // Auth check
  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/admin/login');
        return;
      }
      setAuthenticated(true);
    }
    checkAuth();
  }, [router]);

  // Fetch history when date changes
  useEffect(() => {
    if (!authenticated) return;
    async function fetchHistory() {
      setLoading(true);
      const { start, end } = getTimeRange(selectedDate);

      const { data, error } = await supabase
        .from('attraction_history')
        .select('*')
        .gte('recorded_at', start)
        .lte('recorded_at', end)
        .order('recorded_at', { ascending: true });

      if (error) {
        console.error('Error fetching history:', error);
        setHistoryData([]);
      } else {
        setHistoryData(data || []);
      }
      setLoading(false);
    }
    fetchHistory();
  }, [authenticated, selectedDate]);

  // Transform data for Recharts
  const { chartData, attractionNames, statusPeriods, colorMap } = useMemo(() => {
    if (historyData.length === 0) {
      return { chartData: [], attractionNames: [], statusPeriods: [], colorMap: new Map() };
    }

    // Collect unique attraction names (preserving order of first appearance)
    const namesSet = new Set<string>();
    historyData.forEach((r) => namesSet.add(r.attraction_name));
    const names = Array.from(namesSet);

    // Build color map
    const cMap = new Map<string, string>();
    names.forEach((name, i) => cMap.set(name, LINE_COLORS[i % LINE_COLORS.length]));

    // Build chart data points — only plot wait_time when OPEN
    const timeMap = new Map<number, Record<string, number | string | null>>();
    // Track current status per attraction for forward-fill
    const currentStatus: Record<string, string> = {};
    const currentWait: Record<string, number> = {};

    for (const record of historyData) {
      const time = new Date(record.recorded_at).getTime();
      currentStatus[record.attraction_name] = record.status;
      currentWait[record.attraction_name] = record.wait_time;

      if (!timeMap.has(time)) {
        timeMap.set(time, { time });
      }
      const point = timeMap.get(time)!;
      // Only show wait time line when OPEN
      point[record.attraction_name] = record.status === 'OPEN' ? record.wait_time : null;
    }

    // Sort by time
    const sorted = Array.from(timeMap.values()).sort(
      (a, b) => (a.time as number) - (b.time as number)
    );

    // Forward-fill: carry the last known value for each attraction
    const lastKnown: Record<string, number | null> = {};
    for (const point of sorted) {
      for (const name of names) {
        if (name in point) {
          lastKnown[name] = point[name] as number | null;
        } else if (name in lastKnown) {
          point[name] = lastKnown[name];
        }
      }
    }

    // Build status periods (CLOSED/DELAYED/AT CAPACITY bands)
    const periods: StatusPeriod[] = [];
    const openStatus: Record<string, { status: string; start: number } | null> = {};

    for (const record of historyData) {
      const time = new Date(record.recorded_at).getTime();
      const name = record.attraction_name;
      const prevPeriod = openStatus[name];

      if (record.status !== 'OPEN') {
        if (!prevPeriod || prevPeriod.status !== record.status) {
          // Close previous period if different status
          if (prevPeriod) {
            periods.push({
              attractionName: name,
              status: prevPeriod.status,
              start: prevPeriod.start,
              end: time,
            });
          }
          openStatus[name] = { status: record.status, start: time };
        }
      } else {
        // Going OPEN — close any active non-OPEN period
        if (prevPeriod) {
          periods.push({
            attractionName: name,
            status: prevPeriod.status,
            start: prevPeriod.start,
            end: time,
          });
          openStatus[name] = null;
        }
      }
    }

    // Close any remaining open periods at the last data point time
    if (sorted.length > 0) {
      const lastTime = sorted[sorted.length - 1].time as number;
      for (const name of names) {
        if (openStatus[name]) {
          periods.push({
            attractionName: name,
            status: openStatus[name]!.status,
            start: openStatus[name]!.start,
            end: lastTime,
          });
        }
      }
    }

    return { chartData: sorted, attractionNames: names, statusPeriods: periods, colorMap: cMap };
  }, [historyData]);

  if (!authenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <h1 className="text-bone/60 text-2xl font-semibold">Loading...</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 sm:p-6">
      <header className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-blood-bright text-3xl font-black uppercase tracking-wide sm:text-4xl">
            Queue Analytics
          </h1>
          <p className="text-bone/40 text-sm mt-1">Historical wait time data</p>
        </div>

        <Link
          href="/admin"
          className="px-4 py-2.5 bg-gore border border-blood/30 text-bone/60 hover:text-bone
                     rounded-lg transition-colors text-sm w-fit"
        >
          Back to Control Room
        </Link>
      </header>

      <div className="mx-auto w-full h-px bg-gradient-to-r from-transparent via-blood/50 to-transparent mb-6" />

      {/* Date picker */}
      <div className="flex items-center gap-4 mb-6">
        <label className="text-bone/70 text-sm font-medium">Select Night:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 bg-black/60 border border-gore rounded-lg text-bone text-sm
                     focus:outline-none focus:border-blood-bright transition-colors
                     [color-scheme:dark]"
        />
      </div>

      {/* Chart */}
      {loading ? (
        <div className="horror-card rounded-xl p-12 text-center">
          <p className="text-bone/60 text-lg">Loading historical data...</p>
        </div>
      ) : chartData.length === 0 ? (
        <div className="horror-card rounded-xl p-12 text-center">
          <p className="text-bone/40 text-lg">No data recorded for this night.</p>
          <p className="text-bone/30 text-sm mt-2">
            Data is captured automatically when staff update queue times.
          </p>
        </div>
      ) : (
        <>
          {/* Wait time line chart */}
          <div className="horror-card rounded-xl p-4 sm:p-6 mb-6">
            <h2 className="text-bone text-lg font-bold mb-4">Wait Times — {selectedDate}</h2>
            <ResponsiveContainer width="100%" height={500}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3a0000" />
                {/* Shaded bands for CLOSED / DELAYED / AT CAPACITY periods */}
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
                  stroke="#E8E0D0"
                  tick={{ fill: '#E8E0D0', fontSize: 12 }}
                />
                <YAxis
                  stroke="#E8E0D0"
                  tick={{ fill: '#E8E0D0', fontSize: 12 }}
                  label={{
                    value: 'Wait (min)',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#E8E0D0',
                    style: { fontSize: 12 },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a0000',
                    border: '1px solid #3a0000',
                    borderRadius: '8px',
                    color: '#E8E0D0',
                  }}
                  labelFormatter={(ts) => formatTimeShort(Number(ts))}
                  formatter={(value, name) => {
                    if (value === null || value === undefined) return ['--', name];
                    return [`${value} min`, name];
                  }}
                />
                <Legend wrapperStyle={{ color: '#E8E0D0' }} />
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

            {/* Legend for status bands */}
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/[0.08]">
              <span className="text-bone/50 text-xs font-medium uppercase tracking-wider">Shaded areas:</span>
              {Object.entries(STATUS_LABEL_COLORS).map(([status, color]) => (
                <div key={status} className="flex items-center gap-2">
                  <div
                    className="w-4 h-3 rounded-sm"
                    style={{ backgroundColor: STATUS_BAND_COLORS[status] }}
                  />
                  <span className="text-xs font-medium" style={{ color }}>{status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Status timeline */}
          <div className="horror-card rounded-xl p-4 sm:p-6">
            <h2 className="text-bone text-lg font-bold mb-4">Status Timeline</h2>
            {statusPeriods.length === 0 ? (
              <p className="text-bone/30 text-sm">All attractions were open for the entire night.</p>
            ) : (
              <div className="space-y-3">
                {attractionNames.map((name) => {
                  const periods = statusPeriods.filter((p) => p.attractionName === name);
                  if (periods.length === 0) return null;
                  return (
                    <div key={name}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: colorMap.get(name) }}
                        />
                        <span className="text-bone text-sm font-semibold">{name}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 ml-5">
                        {periods.map((p, i) => (
                          <div
                            key={i}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg border"
                            style={{
                              color: STATUS_LABEL_COLORS[p.status] || '#E8E0D0',
                              borderColor: (STATUS_LABEL_COLORS[p.status] || '#E8E0D0') + '40',
                              backgroundColor: (STATUS_BAND_COLORS[p.status] || '#ffffff10'),
                            }}
                          >
                            {p.status} — {formatTimeShort(p.start)} to {formatTimeShort(p.end)}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
