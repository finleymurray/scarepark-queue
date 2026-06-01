'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import { getAllStatusLogs } from '@/lib/statusLog';
import type { Attraction, AttractionHistory, ThroughputLog, AttractionStatusLog } from '@/types/database';
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

function getTimeRange(dateStr: string): { start: string; end: string } {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59`);
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

type AnalyticsTab = 'queue' | 'throughput' | 'statuslog' | 'summary';

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#111',
  border: '1px solid #2a2a2a',
  borderRadius: '8px',
  color: '#F1F5F9',
  fontSize: 12,
};

const AXIS_TICK_STYLE = { fill: '#475569', fontSize: 11 };
const GRID_STROKE = 'rgba(255,255,255,0.04)';

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-[#94A3B8] text-sm">{message}</p>
      <p className="text-[#64748B] text-xs mt-1">Data is captured automatically when staff update queue times.</p>
    </div>
  );
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
  const [statusLogs, setStatusLogs] = useState<AttractionStatusLog[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [fromTime, setFromTime] = useState('00:00');
  const [toTime, setToTime] = useState('23:59');
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('queue');

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
      const { start, end } = getTimeRange(selectedDate);

      const [historyRes, throughputRes, logs] = await Promise.all([
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
        getAllStatusLogs(selectedDate),
      ]);

      if (historyRes.error) {
        if (process.env.NODE_ENV === 'development') console.error('Error fetching history:', historyRes.error);
        setHistoryData([]);
      } else {
        setHistoryData(historyRes.data || []);
      }

      if (!throughputRes.error) {
        setThroughputData(throughputRes.data || []);
      }

      setStatusLogs(logs);

      setLoading(false);
    }
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, selectedDate, refreshKey]);

  // Filter data by selected time window
  const filteredHistory = useMemo(() => {
    const fromMin = (() => { const [h, m] = fromTime.split(':'); return parseInt(h, 10) * 60 + parseInt(m, 10); })();
    const toMin = (() => { const [h, m] = toTime.split(':'); return parseInt(h, 10) * 60 + parseInt(m, 10); })();
    return historyData.filter((r) => {
      const d = new Date(r.recorded_at);
      const min = d.getHours() * 60 + d.getMinutes();
      return min >= fromMin && min <= toMin;
    });
  }, [historyData, fromTime, toTime]);

  const filteredStatusLogs = useMemo(() => {
    const fromMin = (() => { const [h, m] = fromTime.split(':'); return parseInt(h, 10) * 60 + parseInt(m, 10); })();
    const toMin = (() => { const [h, m] = toTime.split(':'); return parseInt(h, 10) * 60 + parseInt(m, 10); })();
    return statusLogs.filter((r) => {
      const d = new Date(r.changed_at);
      const min = d.getHours() * 60 + d.getMinutes();
      return min >= fromMin && min <= toMin;
    });
  }, [statusLogs, fromTime, toTime]);

  const filteredThroughput = useMemo(() => {
    const fromMin = (() => { const [h, m] = fromTime.split(':'); return parseInt(h, 10) * 60 + parseInt(m, 10); })();
    const toMin = (() => { const [h, m] = toTime.split(':'); return parseInt(h, 10) * 60 + parseInt(m, 10); })();
    return throughputData.filter((r) => {
      const [h, m] = r.slot_start.split(':');
      const min = parseInt(h, 10) * 60 + parseInt(m || '0', 10);
      return min >= fromMin && min <= toMin;
    });
  }, [throughputData, fromTime, toTime]);

  // Transform data for wait time line chart
  const { chartData, attractionNames, statusPeriods, colorMap } = useMemo(() => {
    if (filteredHistory.length === 0) {
      return { chartData: [], attractionNames: [], statusPeriods: [], colorMap: new Map() };
    }

    const namesSet = new Set<string>();
    filteredHistory.forEach((r) => namesSet.add(r.attraction_name));
    const names = Array.from(namesSet);

    const cMap = new Map<string, string>();
    names.forEach((name, i) => cMap.set(name, LINE_COLORS[i % LINE_COLORS.length]));

    const timeMap = new Map<number, Record<string, number | string | null>>();

    for (const record of filteredHistory) {
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

    for (const record of filteredHistory) {
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
  }, [filteredHistory]);

  // Transform throughput data for BarChart
  const { throughputChartData, throughputAttractionNames } = useMemo(() => {
    if (filteredThroughput.length === 0) {
      return { throughputChartData: [], throughputAttractionNames: [] };
    }

    // Resolve attraction names
    const idToName = new Map<string, string>();
    for (const a of attractions) {
      idToName.set(a.id, a.name);
    }
    for (const h of filteredHistory) {
      if (!idToName.has(h.attraction_id)) {
        idToName.set(h.attraction_id, h.attraction_name);
      }
    }

    // Get unique attraction IDs and names
    const attractionIds = Array.from(new Set(filteredThroughput.map((l) => l.attraction_id)));
    const names = attractionIds.map((id) => idToName.get(id) || id.slice(0, 8));

    // Get all unique time slots, sorted
    const allSlots = Array.from(
      new Set(filteredThroughput.map((l) => `${l.slot_start}|${l.slot_end}`))
    ).sort((a, b) => a.split('|')[0].localeCompare(b.split('|')[0]));

    // Build a lookup map for O(1) throughput log access
    const logMap = new Map<string, ThroughputLog>();
    for (const l of filteredThroughput) {
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
  }, [filteredThroughput, attractions, filteredHistory]);

  // Transform data for combined ComposedChart (wait time + throughput by slot)
  const { combinedChartData, combinedAttractionNames } = useMemo(() => {
    if (filteredThroughput.length === 0 && filteredHistory.length === 0) {
      return { combinedChartData: [], combinedAttractionNames: [] };
    }

    // Resolve attraction names
    const idToName = new Map<string, string>();
    for (const a of attractions) {
      idToName.set(a.id, a.name);
    }
    for (const h of filteredHistory) {
      if (!idToName.has(h.attraction_id)) {
        idToName.set(h.attraction_id, h.attraction_name);
      }
    }

    // Get all unique time slots from throughput data
    const allSlots = Array.from(
      new Set(filteredThroughput.map((l) => `${l.slot_start}|${l.slot_end}`))
    ).sort((a, b) => a.split('|')[0].localeCompare(b.split('|')[0]));

    if (allSlots.length === 0) {
      return { combinedChartData: [], combinedAttractionNames: [] };
    }

    // Get unique attraction IDs from throughput
    const attractionIds = Array.from(new Set(filteredThroughput.map((l) => l.attraction_id)));
    const names = attractionIds.map((id) => idToName.get(id) || id.slice(0, 8));

    // Build lookup maps for O(1) access
    const throughputMap = new Map<string, ThroughputLog>();
    for (const l of filteredThroughput) {
      throughputMap.set(`${l.attraction_id}|${l.slot_start}|${l.slot_end}`, l);
    }

    // Group history by attraction name and pre-compute minute offsets
    const historyByName = new Map<string, { min: number; wait_time: number }[]>();
    for (const h of filteredHistory) {
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
  }, [filteredThroughput, filteredHistory, attractions]);

  // Compute structured status log summary
  const statusLogSummary = useMemo(() => {
    if (filteredStatusLogs.length === 0) return null;

    const idToName = new Map<string, string>();
    for (const a of attractions) idToName.set(a.id, a.name);

    const byAttraction = new Map<string, AttractionStatusLog[]>();
    for (const log of filteredStatusLogs) {
      if (!byAttraction.has(log.attraction_id)) byAttraction.set(log.attraction_id, []);
      byAttraction.get(log.attraction_id)!.push(log);
    }

    return Array.from(byAttraction.entries()).map(([id, logs]) => {
      const name = idToName.get(id) || id.slice(0, 8);
      const delayLogs = logs.filter((l) => l.status === 'DELAYED');
      const resolvedDelays = delayLogs.filter((l) => l.resolved_at);

      let totalDowntimeMs = 0;
      for (let i = 0; i < logs.length; i++) {
        if (logs[i].status === 'CLOSED' || logs[i].status === 'DELAYED') {
          const start = new Date(logs[i].changed_at).getTime();
          const nextLog = logs[i + 1];
          const end = nextLog ? new Date(nextLog.changed_at).getTime() : Date.now();
          totalDowntimeMs += end - start;
        }
      }

      let totalDelayMs = 0;
      for (const dl of resolvedDelays) {
        totalDelayMs += new Date(dl.resolved_at!).getTime() - new Date(dl.changed_at).getTime();
      }

      return {
        attractionId: id,
        name,
        logs,
        totalDowntimeMinutes: Math.round(totalDowntimeMs / 60000),
        delayCount: delayLogs.length,
        avgDelayMinutes: resolvedDelays.length > 0
          ? Math.round(totalDelayMs / resolvedDelays.length / 60000)
          : 0,
      };
    });
  }, [filteredStatusLogs, attractions]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalGuests = filteredThroughput.reduce((s, l) => s + l.guest_count, 0);
    const waitTimes = filteredHistory.filter((h) => h.status === 'OPEN' && h.wait_time > 0).map((h) => h.wait_time);
    const avgWait = waitTimes.length > 0 ? Math.round(waitTimes.reduce((s, v) => s + v, 0) / waitTimes.length) : 0;
    const totalDowntime = statusLogSummary ? statusLogSummary.reduce((s, a) => s + a.totalDowntimeMinutes, 0) : 0;
    const delayIncidents = statusLogSummary ? statusLogSummary.reduce((s, a) => s + a.delayCount, 0) : 0;
    const totalMinutes = (() => {
      const [fh, fm] = fromTime.split(':').map(Number);
      const [th, tm] = toTime.split(':').map(Number);
      return (th * 60 + tm) - (fh * 60 + fm);
    })();
    const uptimePct = totalMinutes > 0 ? Math.max(0, Math.round(((totalMinutes - totalDowntime) / totalMinutes) * 100)) : null;
    const attractionsOpen = attractions.filter((a) => a.status === 'OPEN').length;

    return { totalGuests, avgWait, totalDowntime, delayIncidents, uptimePct, attractionsOpen };
  }, [filteredThroughput, filteredHistory, statusLogSummary, fromTime, toTime, attractions]);

  // suppress unused warning for openingTime — it's fetched for future use
  void openingTime;

  const tooltipStyle = CHART_TOOLTIP_STYLE;

  const TABS: { key: AnalyticsTab; label: string }[] = [
    { key: 'queue', label: 'Queue Times' },
    { key: 'throughput', label: 'Throughput' },
    { key: 'statuslog', label: 'Status Log' },
    { key: 'summary', label: 'Summary' },
  ];

  if (!authenticated) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#000000' }}>
        <div style={{ color: '#94A3B8', fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  const hasData = chartData.length > 0 || filteredThroughput.length > 0 || filteredStatusLogs.length > 0;

  return (
    <div className="min-h-screen" style={{ background: '#000000' }}>
      <AdminNav userEmail={userEmail} displayName={displayName} onLogout={handleLogout} />

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        {/* Page header row */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h2 className="text-[#F1F5F9] text-2xl font-bold">Analytics</h2>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: '7px 12px', background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, color: '#F1F5F9', fontSize: 13, outline: 'none', colorScheme: 'dark' }}
            />
            <div className="flex items-center gap-2">
              <span className="text-[#94A3B8] text-xs font-medium">From</span>
              <input
                type="time"
                value={fromTime}
                onChange={(e) => setFromTime(e.target.value)}
                style={{ padding: '7px 10px', background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, color: '#F1F5F9', fontSize: 13, outline: 'none', colorScheme: 'dark' }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#94A3B8] text-xs font-medium">To</span>
              <input
                type="time"
                value={toTime}
                onChange={(e) => setToTime(e.target.value)}
                style={{ padding: '7px 10px', background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, color: '#F1F5F9', fontSize: 13, outline: 'none', colorScheme: 'dark' }}
              />
            </div>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              style={{
                padding: '7px 12px',
                background: '#111',
                border: '1px solid #2a2a2a',
                borderRadius: 8,
                color: '#94A3B8',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M14 8A6 6 0 1 1 8 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M8 0L10.5 2.5L8 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, background: '#111', border: '1px solid #1a1a1a', borderRadius: 10, padding: 4 }}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                padding: '9px 16px',
                borderRadius: 7,
                fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 500,
                border: 'none', cursor: 'pointer',
                background: activeTab === tab.key ? '#1E1E1E' : 'transparent',
                color: activeTab === tab.key ? '#F1F5F9' : '#94A3B8',
                transition: 'background 0.15s, color 0.15s',
                boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-16 text-center">
            <p className="text-[#94A3B8] text-sm">Loading historical data...</p>
          </div>
        ) : !hasData && activeTab !== 'summary' ? (
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl">
            <EmptyState message="No data recorded for this date." />
          </div>
        ) : (
          <>
            {/* ── Queue Times Tab ── */}
            {activeTab === 'queue' && (
              <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6">
                {chartData.length === 0 ? (
                  <EmptyState message="No wait time data for this date." />
                ) : (
                  <>
                    <h3 className="text-[#F1F5F9] text-base font-semibold mb-5">Wait Times — {selectedDate}</h3>
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

                    {/* Status band legend */}
                    {statusPeriods.length > 0 && (
                      <div className="flex items-center gap-6 mt-4 pt-4 border-t border-[#2a2a2a]">
                        <span className="text-[#94A3B8] text-[10px] font-semibold uppercase tracking-wider">Shaded:</span>
                        {Object.entries(STATUS_LABEL_COLORS).map(([status, color]) => (
                          <div key={status} className="flex items-center gap-1.5">
                            <div className="w-3 h-2.5 rounded-sm" style={{ backgroundColor: STATUS_BAND_COLORS[status] }} />
                            <span className="text-[11px] font-medium" style={{ color }}>{status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Throughput Tab ── */}
            {activeTab === 'throughput' && (
              <div className="space-y-4">
                {filteredThroughput.length === 0 ? (
                  <div className="bg-[#111] border border-[#2a2a2a] rounded-xl">
                    <EmptyState message="No throughput data logged for this date." />
                  </div>
                ) : (
                  <>
                    {/* Total guests */}
                    <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
                      <p className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wider mb-1">Total Guests</p>
                      <p className="text-[#F1F5F9] text-3xl font-bold">
                        {filteredThroughput.reduce((s, l) => s + l.guest_count, 0).toLocaleString()}
                      </p>
                    </div>

                    {/* Bar chart */}
                    <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6">
                      <h3 className="text-[#F1F5F9] text-base font-semibold mb-5">Guest Throughput — {selectedDate}</h3>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={throughputChartData}>
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
                          {throughputAttractionNames.map((name, i) => (
                            <Bar
                              key={name}
                              dataKey={name}
                              fill={LINE_COLORS[i % LINE_COLORS.length]}
                              radius={[3, 3, 0, 0]}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Combined chart */}
                    {combinedChartData.length > 0 && combinedAttractionNames.length > 0 && (
                      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6">
                        <h3 className="text-[#F1F5F9] text-base font-semibold mb-1">Wait Time vs Throughput</h3>
                        <p className="text-[#94A3B8] text-xs mb-5">Lines: avg wait time per slot. Bars: guest throughput.</p>
                        <ResponsiveContainer width="100%" height={280}>
                          <ComposedChart data={combinedChartData}>
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

                    {/* Throughput summary table */}
                    <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6">
                      <h3 className="text-[#F1F5F9] text-base font-semibold mb-4">Throughput Summary</h3>
                      {(() => {
                        const idToLogs = new Map<string, ThroughputLog[]>();
                        for (const log of filteredThroughput) {
                          if (!idToLogs.has(log.attraction_id)) idToLogs.set(log.attraction_id, []);
                          idToLogs.get(log.attraction_id)!.push(log);
                        }

                        const idToName = new Map<string, string>();
                        for (const a of attractions) {
                          idToName.set(a.id, a.name);
                        }
                        for (const h of filteredHistory) {
                          if (!idToName.has(h.attraction_id)) {
                            idToName.set(h.attraction_id, h.attraction_name);
                          }
                        }

                        const allSlots = Array.from(
                          new Set(filteredThroughput.map((l) => `${l.slot_start}|${l.slot_end}`))
                        ).sort((a, b) => a.split('|')[0].localeCompare(b.split('|')[0]));

                        const attractionIds = Array.from(idToLogs.keys());
                        const parkTotal = filteredThroughput.reduce((sum, l) => sum + l.guest_count, 0);

                        const logLookups = new Map<string, Map<string, ThroughputLog>>();
                        for (const id of attractionIds) {
                          const slotMap = new Map<string, ThroughputLog>();
                          for (const l of idToLogs.get(id)!) {
                            slotMap.set(`${l.slot_start}|${l.slot_end}`, l);
                          }
                          logLookups.set(id, slotMap);
                        }

                        const slotTotals = new Map<string, number>();
                        for (const l of filteredThroughput) {
                          const key = `${l.slot_start}|${l.slot_end}`;
                          slotTotals.set(key, (slotTotals.get(key) || 0) + l.guest_count);
                        }

                        return (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                                  <th className="text-left text-[#94A3B8] font-medium py-2 pr-4 whitespace-nowrap text-xs">Attraction</th>
                                  {allSlots.map((slot) => {
                                    const [start, end] = slot.split('|');
                                    return (
                                      <th key={slot} className="text-center text-[#94A3B8] font-medium py-2 px-2 whitespace-nowrap text-xs">
                                        {start}–{end}
                                      </th>
                                    );
                                  })}
                                  <th className="text-center text-[#F1F5F9] font-semibold py-2 pl-4 whitespace-nowrap text-xs">Total</th>
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
                                    <tr key={id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                                      <td className="py-2 pr-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: nameColor }} />
                                          <span className="text-[#F1F5F9] text-sm font-medium">{name}</span>
                                        </div>
                                      </td>
                                      {allSlots.map((slot) => {
                                        const log = slotMap.get(slot);
                                        return (
                                          <td key={slot} className="text-center py-2 px-2">
                                            {log && log.guest_count > 0 ? (
                                              <span className="text-[#F1F5F9] font-medium">{log.guest_count}</span>
                                            ) : (
                                              <span className="text-white/20">—</span>
                                            )}
                                          </td>
                                        );
                                      })}
                                      <td className="text-center py-2 pl-4">
                                        <span className="text-[#F1F5F9] font-bold">{total}</span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr style={{ borderTop: '1px solid #2a2a2a' }}>
                                  <td className="py-3 pr-4">
                                    <span className="text-[#94A3B8] font-semibold text-sm">Park Total</span>
                                  </td>
                                  {allSlots.map((slot) => {
                                    const total = slotTotals.get(slot) || 0;
                                    return (
                                      <td key={slot} className="text-center py-3 px-2">
                                        <span className="text-[#94A3B8] font-semibold">{total > 0 ? total : '—'}</span>
                                      </td>
                                    );
                                  })}
                                  <td className="text-center py-3 pl-4">
                                    <span className="text-[#F1F5F9] font-black text-base">{parkTotal}</span>
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
              </div>
            )}

            {/* ── Status Log Tab ── */}
            {activeTab === 'statuslog' && (
              <div className="space-y-4">
                {filteredStatusLogs.length === 0 ? (
                  <div className="bg-[#111] border border-[#2a2a2a] rounded-xl">
                    <EmptyState message="No status changes recorded for this date." />
                  </div>
                ) : (
                  <>
                    {/* Status timeline */}
                    {statusPeriods.length > 0 && (
                      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6">
                        <h3 className="text-[#F1F5F9] text-base font-semibold mb-4">Status Timeline</h3>
                        <div className="space-y-3">
                          {attractionNames.map((name) => {
                            const periods = statusPeriods.filter((p) => p.attractionName === name);
                            if (periods.length === 0) return null;
                            return (
                              <div key={name}>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <div
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: colorMap.get(name) }}
                                  />
                                  <span className="text-[#F1F5F9] text-sm font-semibold">{name}</span>
                                </div>
                                <div className="flex flex-wrap gap-2 ml-4">
                                  {periods.map((p, i) => (
                                    <div
                                      key={i}
                                      className="text-xs font-medium px-3 py-1.5 rounded-lg border"
                                      style={{
                                        color: STATUS_LABEL_COLORS[p.status] || '#F1F5F9',
                                        borderColor: (STATUS_LABEL_COLORS[p.status] || '#F1F5F9') + '40',
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
                      </div>
                    )}

                    {/* Summary stats */}
                    {statusLogSummary && (
                      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6">
                        <h3 className="text-[#F1F5F9] text-base font-semibold mb-4">Downtime Summary</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                          {statusLogSummary.map((s) => (
                            <div key={s.attractionId} style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 10, padding: 14 }}>
                              <div className="text-[#F1F5F9] text-sm font-semibold mb-2">{s.name}</div>
                              <div className="text-[#94A3B8] text-xs space-y-1.5">
                                <div>Delays: <span className="text-[#94A3B8] font-semibold">{s.delayCount || '—'}</span></div>
                                <div>Avg delay: <span className="text-[#94A3B8] font-semibold">{s.avgDelayMinutes > 0 ? `${s.avgDelayMinutes} min` : '—'}</span></div>
                                <div>Total downtime: <span className="text-[#94A3B8] font-semibold">{s.totalDowntimeMinutes > 0 ? `${s.totalDowntimeMinutes} min` : '—'}</span></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Detailed log table */}
                    <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6">
                      <h3 className="text-[#F1F5F9] text-base font-semibold mb-4">Status Change Log — {selectedDate}</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs uppercase tracking-wider" style={{ borderBottom: '1px solid #2a2a2a', color: '#94A3B8' }}>
                              <th className="text-left px-3 py-2 font-medium">Time</th>
                              <th className="text-left px-3 py-2 font-medium">Attraction</th>
                              <th className="text-left px-3 py-2 font-medium">Transition</th>
                              <th className="text-left px-3 py-2 font-medium">Reason</th>
                              <th className="text-left px-3 py-2 font-medium">Duration</th>
                              <th className="text-left px-3 py-2 font-medium">Changed By</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredStatusLogs.map((log, i) => {
                              const idToName = new Map<string, string>();
                              for (const a of attractions) idToName.set(a.id, a.name);
                              const name = idToName.get(log.attraction_id) || log.attraction_id.slice(0, 8);
                              const nextLog = filteredStatusLogs.slice(i + 1).find(
                                (l) => l.attraction_id === log.attraction_id,
                              );
                              const durationMs = nextLog
                                ? new Date(nextLog.changed_at).getTime() - new Date(log.changed_at).getTime()
                                : null;
                              const durationMin = durationMs !== null ? Math.round(durationMs / 60000) : null;

                              return (
                                <tr key={log.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                                  <td className="px-3 py-2 text-[#94A3B8] tabular-nums text-xs whitespace-nowrap">
                                    {new Date(log.changed_at).toLocaleTimeString('en-GB', {
                                      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
                                    })}
                                  </td>
                                  <td className="px-3 py-2 text-[#F1F5F9] font-medium">{name}</td>
                                  <td className="px-3 py-2">
                                    <span className="text-[#94A3B8]">{log.previous_status || '?'}</span>
                                    <span className="text-[#64748B] mx-1">&rarr;</span>
                                    <span
                                      className="font-medium"
                                      style={{ color: STATUS_LABEL_COLORS[log.status] || '#F1F5F9' }}
                                    >
                                      {log.status}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-[#f0ad4e] text-xs">
                                    {log.reason || <span className="text-[#64748B]">—</span>}
                                    {log.notes && (
                                      <span className="text-[#94A3B8] ml-1" title={log.notes}>*</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-[#94A3B8] tabular-nums text-xs">
                                    {durationMin !== null ? `${durationMin} min` : <span className="text-[#64748B]">—</span>}
                                  </td>
                                  <td className="px-3 py-2 text-[#94A3B8] text-xs">{log.changed_by}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Summary Tab ── */}
            {activeTab === 'summary' && (
              <div className="space-y-4">
                {/* Key stat cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                  {[
                    { label: 'Total Guests', value: summaryStats.totalGuests.toLocaleString() },
                    { label: 'Avg Wait Time', value: summaryStats.avgWait > 0 ? `${summaryStats.avgWait} min` : '—' },
                    { label: 'Total Downtime', value: summaryStats.totalDowntime > 0 ? `${summaryStats.totalDowntime} min` : '—' },
                    { label: 'Uptime', value: summaryStats.uptimePct !== null ? `${summaryStats.uptimePct}%` : '—' },
                    { label: 'Delay Incidents', value: String(summaryStats.delayIncidents) },
                    { label: 'Attractions Open', value: String(summaryStats.attractionsOpen) },
                  ].map((stat) => (
                    <div key={stat.label} style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 12, padding: '20px 20px 18px' }}>
                      <p style={{ color: '#94A3B8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{stat.label}</p>
                      <p style={{ color: '#F1F5F9', fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Per-attraction summary */}
                {statusLogSummary && statusLogSummary.length > 0 && (
                  <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6">
                    <h3 className="text-[#F1F5F9] text-base font-semibold mb-4">Per-Attraction Summary</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                            {['Attraction', 'Delays', 'Avg Delay', 'Total Downtime'].map((h) => (
                              <th key={h} className="text-left px-3 py-2 text-[#94A3B8] text-xs font-semibold uppercase tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {statusLogSummary.map((s) => (
                            <tr key={s.attractionId} style={{ borderBottom: '1px solid #1a1a1a' }}>
                              <td className="px-3 py-3 text-[#F1F5F9] font-medium">{s.name}</td>
                              <td className="px-3 py-3 text-[#94A3B8]">{s.delayCount > 0 ? s.delayCount : <span className="text-[#64748B]">—</span>}</td>
                              <td className="px-3 py-3 text-[#94A3B8]">{s.avgDelayMinutes > 0 ? `${s.avgDelayMinutes} min` : <span className="text-[#64748B]">—</span>}</td>
                              <td className="px-3 py-3 text-[#94A3B8]">{s.totalDowntimeMinutes > 0 ? `${s.totalDowntimeMinutes} min` : <span className="text-[#64748B]">—</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {!hasData && (
                  <div className="bg-[#111] border border-[#2a2a2a] rounded-xl">
                    <EmptyState message="No data recorded for this date." />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
