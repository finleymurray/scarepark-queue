'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import type { Attraction, AttractionHistory, ThroughputLog } from '@/types/database';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceArea,
  BarChart, Bar, ComposedChart,
} from 'recharts';

const LINE_COLORS = [
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

const STATUS_BAND_COLORS: Record<string, string> = {
  'CLOSED': '#dc354525',
  'DELAYED': '#f0ad4e25',
  'AT CAPACITY': '#F59E0B25',
};

const STATUS_LABEL_COLORS: Record<string, string> = {
  'CLOSED': '#dc3545',
  'DELAYED': '#f0ad4e',
  'AT CAPACITY': '#F59E0B',
};

interface StatusPeriod {
  attractionName: string;
  status: string;
  start: number;
  end: number;
}

function getTimeRange(dateStr: string, openTime?: string): { start: string; end: string } {
  const startHour = openTime || '17:00';
  const start = new Date(`${dateStr}T${startHour}:00`);
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

function formatSlotTime(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${m || '00'} ${ampm}`;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState<AttractionHistory[]>([]);
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().split('T')[0]
  );
  const [openingTime, setOpeningTime] = useState('');
  const [throughputData, setThroughputData] = useState<ThroughputLog[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  // Auth check + fetch settings (parallelized)
  useEffect(() => {
    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || auth.role !== 'admin') {
        router.push('/login');
        return;
      }
      setUserEmail(auth.email || '');
      setDisplayName(auth.displayName || '');
      setAuthenticated(true);

      const [settingsRes, attractionsRes] = await Promise.all([
        supabase.from('park_settings').select('key,value').eq('key', 'opening_time').single(),
        supabase.from('attractions').select('id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at').order('sort_order', { ascending: true }),
      ]);

      if (settingsRes.data) {
        setOpeningTime(settingsRes.data.value);
      }
      if (attractionsRes.data) setAttractions(attractionsRes.data);
    }
    init();
  }, [router]);

  // Fetch history + throughput when date changes
  useEffect(() => {
    if (!authenticated) return;
    async function fetchData() {
      setLoading(true);
      const { start, end } = getTimeRange(selectedDate, openingTime || undefined);

      const [historyRes, throughputRes] = await Promise.all([
        supabase
          .from('attraction_history')
          .select('id,attraction_id,attraction_name,status,wait_time,recorded_at')
          .gte('recorded_at', start)
          .lte('recorded_at', end)
          .order('recorded_at', { ascending: true }),
        supabase
          .from('throughput_logs')
          .select('id,attraction_id,slot_start,slot_end,guest_count,logged_by,log_date,created_at,updated_at')
          .eq('log_date', selectedDate),
      ]);

      if (historyRes.error) {
        console.error('Error fetching history:', historyRes.error);
        setHistoryData([]);
      } else {
        setHistoryData(historyRes.data || []);
      }

      if (!throughputRes.error) {
        setThroughputData(throughputRes.data || []);
      }

      setLoading(false);
    }
    fetchData();
  }, [authenticated, selectedDate, openingTime]);

  // Transform data for wait time line chart
  const { chartData, attractionNames, statusPeriods, colorMap } = useMemo(() => {
    if (historyData.length === 0) {
      return { chartData: [], attractionNames: [], statusPeriods: [], colorMap: new Map() };
    }

    const namesSet = new Set<string>();
    historyData.forEach((r) => namesSet.add(r.attraction_name));
    const names = Array.from(namesSet);

    const cMap = new Map<string, string>();
    names.forEach((name, i) => cMap.set(name, LINE_COLORS[i % LINE_COLORS.length]));

    const timeMap = new Map<number, Record<string, number | string | null>>();

    for (const record of historyData) {
      const time = new Date(record.recorded_at).getTime();

      if (!timeMap.has(time)) {
        timeMap.set(time, { time });
      }
      const point = timeMap.get(time)!;
      point[record.attraction_name] = record.status === 'OPEN' ? record.wait_time : null;
    }

    const sorted = Array.from(timeMap.values()).sort(
      (a, b) => (a.time as number) - (b.time as number)
    );

    // Forward-fill
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

    // Build status periods
    const periods: StatusPeriod[] = [];
    const openStatus: Record<string, { status: string; start: number } | null> = {};

    for (const record of historyData) {
      const time = new Date(record.recorded_at).getTime();
      const name = record.attraction_name;
      const prevPeriod = openStatus[name];

      if (record.status !== 'OPEN') {
        if (!prevPeriod || prevPeriod.status !== record.status) {
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

  // Transform throughput data for BarChart
  const { throughputChartData, throughputAttractionNames } = useMemo(() => {
    if (throughputData.length === 0) {
      return { throughputChartData: [], throughputAttractionNames: [] };
    }

    // Resolve attraction names
    const idToName = new Map<string, string>();
    for (const a of attractions) {
      idToName.set(a.id, a.name);
    }
    for (const h of historyData) {
      if (!idToName.has(h.attraction_id)) {
        idToName.set(h.attraction_id, h.attraction_name);
      }
    }

    // Get unique attraction IDs and names
    const attractionIds = Array.from(new Set(throughputData.map((l) => l.attraction_id)));
    const names = attractionIds.map((id) => idToName.get(id) || id.slice(0, 8));

    // Get all unique time slots, sorted
    const allSlots = Array.from(
      new Set(throughputData.map((l) => `${l.slot_start}|${l.slot_end}`))
    ).sort((a, b) => a.split('|')[0].localeCompare(b.split('|')[0]));

    // Build a lookup map for O(1) throughput log access
    const logMap = new Map<string, ThroughputLog>();
    for (const l of throughputData) {
      logMap.set(`${l.attraction_id}|${l.slot_start}|${l.slot_end}`, l);
    }

    // Build chart data: one row per slot, one key per attraction name
    const data = allSlots.map((slot) => {
      const [start, end] = slot.split('|');
      const row: Record<string, string | number> = {
        slot: `${formatSlotTime(start)}–${formatSlotTime(end)}`,
      };
      attractionIds.forEach((id, idx) => {
        const log = logMap.get(`${id}|${start}|${end}`);
        row[names[idx]] = log?.guest_count || 0;
      });
      return row;
    });

    return { throughputChartData: data, throughputAttractionNames: names };
  }, [throughputData, attractions, historyData]);

  // Transform data for combined ComposedChart (wait time + throughput by slot)
  const { combinedChartData, combinedAttractionNames } = useMemo(() => {
    if (throughputData.length === 0 && historyData.length === 0) {
      return { combinedChartData: [], combinedAttractionNames: [] };
    }

    // Resolve attraction names
    const idToName = new Map<string, string>();
    for (const a of attractions) {
      idToName.set(a.id, a.name);
    }
    for (const h of historyData) {
      if (!idToName.has(h.attraction_id)) {
        idToName.set(h.attraction_id, h.attraction_name);
      }
    }

    // Get all unique time slots from throughput data
    const allSlots = Array.from(
      new Set(throughputData.map((l) => `${l.slot_start}|${l.slot_end}`))
    ).sort((a, b) => a.split('|')[0].localeCompare(b.split('|')[0]));

    if (allSlots.length === 0) {
      return { combinedChartData: [], combinedAttractionNames: [] };
    }

    // Get unique attraction IDs from throughput
    const attractionIds = Array.from(new Set(throughputData.map((l) => l.attraction_id)));
    const names = attractionIds.map((id) => idToName.get(id) || id.slice(0, 8));

    // Build lookup maps for O(1) access
    const throughputMap = new Map<string, ThroughputLog>();
    for (const l of throughputData) {
      throughputMap.set(`${l.attraction_id}|${l.slot_start}|${l.slot_end}`, l);
    }

    // Group history by attraction name and pre-compute minute offsets
    const historyByName = new Map<string, { min: number; wait_time: number }[]>();
    for (const h of historyData) {
      if (h.status !== 'OPEN') continue;
      const recorded = new Date(h.recorded_at);
      const recordedMin = recorded.getHours() * 60 + recorded.getMinutes();
      if (!historyByName.has(h.attraction_name)) {
        historyByName.set(h.attraction_name, []);
      }
      historyByName.get(h.attraction_name)!.push({ min: recordedMin, wait_time: h.wait_time });
    }

    // For each slot, calculate avg wait time from history data
    const data = allSlots.map((slot) => {
      const [start, end] = slot.split('|');
      const row: Record<string, string | number> = {
        slot: `${formatSlotTime(start)}–${formatSlotTime(end)}`,
      };

      const slotStartParts = start.split(':');
      const slotEndParts = end.split(':');
      const slotStartMin = parseInt(slotStartParts[0], 10) * 60 + parseInt(slotStartParts[1] || '0', 10);
      const slotEndMin = parseInt(slotEndParts[0], 10) * 60 + parseInt(slotEndParts[1] || '0', 10);

      attractionIds.forEach((id, idx) => {
        const name = names[idx];

        // Throughput bar — O(1) lookup
        const log = throughputMap.get(`${id}|${start}|${end}`);
        row[`${name} (guests)`] = log?.guest_count || 0;

        // Average wait time from pre-grouped history
        const entries = historyByName.get(name);
        if (entries) {
          let sum = 0;
          let count = 0;
          for (const e of entries) {
            if (e.min >= slotStartMin && e.min < slotEndMin) {
              sum += e.wait_time;
              count++;
            }
          }
          if (count > 0) {
            row[`${name} (wait)`] = Math.round(sum / count);
          }
        }
      });

      return row;
    });

    return { combinedChartData: data, combinedAttractionNames: names };
  }, [throughputData, historyData, attractions]);

  const tooltipStyle = {
    backgroundColor: '#0a0a0a',
    border: '1px solid #333',
    borderRadius: '4px',
    color: '#fff',
  };

  if (!authenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <h1 className="text-white/40 text-lg">Loading...</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <AdminNav userEmail={userEmail} displayName={displayName} onLogout={handleLogout} />

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      {/* Date picker */}
      <div className="flex items-center gap-4 mb-6">
        <label className="text-[#888] text-sm font-medium">Select Night:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 bg-[#1a1a1a] border border-[#444] rounded-md text-white text-sm
                     focus:outline-none focus:border-[#6ea8fe] transition-colors
                     [color-scheme:dark]"
        />
      </div>

      {/* Charts */}
      {loading ? (
        <div className="panel p-12 text-center">
          <p className="text-[#888] text-lg">Loading historical data...</p>
        </div>
      ) : (
        <>
          {chartData.length === 0 && throughputData.length === 0 ? (
            <div className="panel p-12 text-center mb-6">
              <p className="text-[#666] text-lg">No data recorded for this night.</p>
              <p className="text-[#444] text-sm mt-2">
                Data is captured automatically when staff update queue times.
              </p>
            </div>
          ) : (
            <>
              {/* ── Wait Time Line Chart ── */}
              {chartData.length > 0 && (
                <>
                  <div className="panel p-4 sm:p-6 mb-6">
                    <h2 className="text-white text-lg font-bold mb-4">Wait Times — {selectedDate}</h2>
                    <ResponsiveContainer width="100%" height={500}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
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
                          stroke="#fff"
                          tick={{ fill: '#fff', fontSize: 12 }}
                        />
                        <YAxis
                          stroke="#fff"
                          tick={{ fill: '#fff', fontSize: 12 }}
                          label={{
                            value: 'Wait (min)',
                            angle: -90,
                            position: 'insideLeft',
                            fill: '#fff',
                            style: { fontSize: 12 },
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
                        <Legend wrapperStyle={{ color: '#fff' }} />
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
                    <div className="flex items-center gap-6 mt-4 pt-4 border-t border-[#333]">
                      <span className="text-[#888] text-xs font-medium uppercase tracking-wider">Shaded areas:</span>
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
                  <div className="panel p-4 sm:p-6 mb-6">
                    <h2 className="text-white text-lg font-bold mb-4">Status Timeline</h2>
                    {statusPeriods.length === 0 ? (
                      <p className="text-[#666] text-sm">All attractions were open for the entire night.</p>
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
                                <span className="text-white text-sm font-semibold">{name}</span>
                              </div>
                              <div className="flex flex-wrap gap-2 ml-5">
                                {periods.map((p, i) => (
                                  <div
                                    key={i}
                                    className="text-xs font-medium px-3 py-1.5 rounded border"
                                    style={{
                                      color: STATUS_LABEL_COLORS[p.status] || '#fff',
                                      borderColor: (STATUS_LABEL_COLORS[p.status] || '#fff') + '40',
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

              {/* ── Throughput Bar Chart ── */}
              {throughputChartData.length > 0 && (
                <div className="panel p-4 sm:p-6 mb-6">
                  <h2 className="text-white text-lg font-bold mb-4">Guest Throughput — {selectedDate}</h2>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={throughputChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis
                        dataKey="slot"
                        stroke="#fff"
                        tick={{ fill: '#fff', fontSize: 11 }}
                        angle={-30}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis
                        stroke="#fff"
                        tick={{ fill: '#fff', fontSize: 12 }}
                        label={{
                          value: 'Guests',
                          angle: -90,
                          position: 'insideLeft',
                          fill: '#fff',
                          style: { fontSize: 12 },
                        }}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ color: '#fff' }} />
                      {throughputAttractionNames.map((name, i) => (
                        <Bar
                          key={name}
                          dataKey={name}
                          fill={LINE_COLORS[i % LINE_COLORS.length]}
                          radius={[2, 2, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* ── Combined Wait Time + Throughput Chart ── */}
              {combinedChartData.length > 0 && combinedAttractionNames.length > 0 && (
                <div className="panel p-4 sm:p-6 mb-6">
                  <h2 className="text-white text-lg font-bold mb-2">Wait Time vs Throughput — {selectedDate}</h2>
                  <p className="text-[#888] text-xs mb-4">Lines show average wait time per slot. Bars show guest throughput.</p>
                  <ResponsiveContainer width="100%" height={450}>
                    <ComposedChart data={combinedChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis
                        dataKey="slot"
                        stroke="#fff"
                        tick={{ fill: '#fff', fontSize: 11 }}
                        angle={-30}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis
                        yAxisId="left"
                        stroke="#fff"
                        tick={{ fill: '#fff', fontSize: 12 }}
                        label={{
                          value: 'Wait (min)',
                          angle: -90,
                          position: 'insideLeft',
                          fill: '#fff',
                          style: { fontSize: 12 },
                        }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#fff"
                        tick={{ fill: '#fff', fontSize: 12 }}
                        label={{
                          value: 'Guests',
                          angle: 90,
                          position: 'insideRight',
                          fill: '#fff',
                          style: { fontSize: 12 },
                        }}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ color: '#fff' }} />
                      {combinedAttractionNames.map((name, i) => (
                        <Bar
                          key={`bar-${name}`}
                          yAxisId="right"
                          dataKey={`${name} (guests)`}
                          fill={LINE_COLORS[i % LINE_COLORS.length]}
                          fillOpacity={0.35}
                          radius={[2, 2, 0, 0]}
                        />
                      ))}
                      {combinedAttractionNames.map((name, i) => (
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
                </div>
              )}

              {/* ── Throughput Summary Table ── */}
              <div className="panel p-4 sm:p-6">
                <h2 className="text-white text-lg font-bold mb-4">Throughput Summary — {selectedDate}</h2>
                {throughputData.length === 0 ? (
                  <p className="text-[#666] text-sm">No throughput data logged for this night.</p>
                ) : (() => {
                  const idToLogs = new Map<string, ThroughputLog[]>();
                  for (const log of throughputData) {
                    if (!idToLogs.has(log.attraction_id)) idToLogs.set(log.attraction_id, []);
                    idToLogs.get(log.attraction_id)!.push(log);
                  }

                  const idToName = new Map<string, string>();
                  for (const a of attractions) {
                    idToName.set(a.id, a.name);
                  }
                  for (const h of historyData) {
                    if (!idToName.has(h.attraction_id)) {
                      idToName.set(h.attraction_id, h.attraction_name);
                    }
                  }

                  const allSlots = Array.from(
                    new Set(throughputData.map((l) => `${l.slot_start}|${l.slot_end}`))
                  ).sort((a, b) => a.split('|')[0].localeCompare(b.split('|')[0]));

                  const attractionIds = Array.from(idToLogs.keys());
                  const parkTotal = throughputData.reduce((sum, l) => sum + l.guest_count, 0);

                  // Build per-attraction lookup maps for O(1) slot access
                  const logLookups = new Map<string, Map<string, ThroughputLog>>();
                  for (const id of attractionIds) {
                    const slotMap = new Map<string, ThroughputLog>();
                    for (const l of idToLogs.get(id)!) {
                      slotMap.set(`${l.slot_start}|${l.slot_end}`, l);
                    }
                    logLookups.set(id, slotMap);
                  }

                  // Pre-compute slot totals
                  const slotTotals = new Map<string, number>();
                  for (const l of throughputData) {
                    const key = `${l.slot_start}|${l.slot_end}`;
                    slotTotals.set(key, (slotTotals.get(key) || 0) + l.guest_count);
                  }

                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#333]">
                            <th className="text-left text-[#888] font-medium py-2 pr-4 whitespace-nowrap">Attraction</th>
                            {allSlots.map((slot) => {
                              const [start, end] = slot.split('|');
                              return (
                                <th key={slot} className="text-center text-[#888] font-medium py-2 px-2 whitespace-nowrap">
                                  {start}–{end}
                                </th>
                              );
                            })}
                            <th className="text-center text-white font-semibold py-2 pl-4 whitespace-nowrap">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attractionIds.map((id) => {
                            const logs = idToLogs.get(id)!;
                            const name = idToName.get(id) || id.slice(0, 8);
                            const total = logs.reduce((sum, l) => sum + l.guest_count, 0);
                            const nameColor = colorMap.get(name) || LINE_COLORS[attractionIds.indexOf(id) % LINE_COLORS.length];
                            const slotMap = logLookups.get(id)!;

                            return (
                              <tr key={id} className="border-b border-[#222]">
                                <td className="py-2 pr-4 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: nameColor }} />
                                    <span className="text-white text-sm font-medium">{name}</span>
                                  </div>
                                </td>
                                {allSlots.map((slot) => {
                                  const log = slotMap.get(slot);
                                  return (
                                    <td key={slot} className="text-center py-2 px-2">
                                      {log && log.guest_count > 0 ? (
                                        <span className="text-white font-medium">{log.guest_count}</span>
                                      ) : (
                                        <span className="text-white/20">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="text-center py-2 pl-4">
                                  <span className="text-white font-bold">{total}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-[#333]">
                            <td className="py-3 pr-4">
                              <span className="text-[#888] font-semibold text-sm">Park Total</span>
                            </td>
                            {allSlots.map((slot) => {
                              const total = slotTotals.get(slot) || 0;
                              return (
                                <td key={slot} className="text-center py-3 px-2">
                                  <span className="text-[#888] font-semibold">{total > 0 ? total : '—'}</span>
                                </td>
                              );
                            })}
                            <td className="text-center py-3 pl-4">
                              <span className="text-white font-black text-base">{parkTotal}</span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </>
      )}
      </main>
    </div>
  );
}
