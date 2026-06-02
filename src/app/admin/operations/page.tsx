'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import { getAllStatusLogs } from '@/lib/statusLog';
import { getAttractionLogo, getLogoGlow } from '@/lib/logos';
import type { Attraction, AttractionHistory, AttractionStatus, AttractionStatusLog, ThroughputLog, DispatchLog } from '@/types/database';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

/* ── Helpers ── */

function getTodayDateStr(): string {
  return new Date().toISOString().split('T')[0];
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return 'ongoing';
  const secs = Math.floor((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000);
  return formatElapsed(secs);
}

const STATUS_COLORS: Record<AttractionStatus, string> = {
  OPEN: '#22C55E',
  CLOSED: '#dc3545',
  DELAYED: '#f0ad4e',
  'AT CAPACITY': '#F59E0B',
};

const STATUS_BG: Record<AttractionStatus, string> = {
  OPEN: 'rgba(34,197,94,0.15)',
  CLOSED: 'rgba(220,53,69,0.15)',
  DELAYED: 'rgba(240,173,78,0.15)',
  'AT CAPACITY': 'rgba(245,158,11,0.15)',
};

/* ── Per-attraction data structures ── */

interface DelayIncident {
  log: AttractionStatusLog;
  durationSecs: number | null; // null = ongoing
}

interface AttractionOps {
  attraction: Attraction;
  currentStatus: AttractionStatus;
  openedAt: string | null;
  closedAt: string | null;
  delays: DelayIncident[];
  totalDowntimeSecs: number;
  activeDelay: AttractionStatusLog | null;
  history: AttractionHistory[];
  totalGuests: number;
  avgDispatchIntervalSecs: number | null; // null = fewer than 2 dispatches
  totalDispatches: number;
}

/* ── Queue time sparkline ── */

interface ChartPoint { t: number; wait: number | null; label: string }

function formatHourLabel(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}${ampm}`;
}

function formatTooltipTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function QueueChart({
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

  // Build domain from park hours for the selected date so the x-axis always
  // spans the full operating window even early in the night with sparse data.
  // Fall back to the data bounds if park hours aren't configured.
  let domainStart: number;
  let domainEnd: number;

  if (openTime && closeTime) {
    // Parse park hours as local time on the selected date
    domainStart = new Date(`${dateStr}T${openTime}:00`).getTime();
    domainEnd   = new Date(`${dateStr}T${closeTime}:00`).getTime();
    // Handle crossing midnight
    if (domainEnd <= domainStart) domainEnd += 24 * 60 * 60 * 1000;
    // Add 1 hour buffer after close for queue clearance
    domainEnd += 60 * 60 * 1000;
  } else {
    // Fallback: derive from data
    const timestamps = history.map((h) => new Date(h.recorded_at).getTime());
    domainStart = Math.floor(Math.min(...timestamps) / 3_600_000) * 3_600_000;
    domainEnd   = Math.ceil(Math.max(...timestamps)  / 3_600_000) * 3_600_000 + 15 * 60_000;
  }

  // Build data points from history
  const dataPoints: ChartPoint[] = history.map((h) => ({
    t: new Date(h.recorded_at).getTime(),
    wait: h.status === 'OPEN' || h.status === 'AT CAPACITY' ? h.wait_time : null,
    label: formatTooltipTime(new Date(h.recorded_at).getTime()),
  }));

  if (dataPoints.length === 0) return null;

  // Inject invisible boundary points at domainStart and domainEnd so Recharts
  // always renders the chart across the full operating window regardless of
  // how many actual data points exist. null wait = no line drawn.
  const points: ChartPoint[] = [
    { t: domainStart, wait: null, label: formatTooltipTime(domainStart) },
    ...dataPoints,
    { t: domainEnd, wait: null, label: formatTooltipTime(domainEnd) },
  ];

  // Delay reference lines
  const delayBands = delays.map((d) => ({
    start: new Date(d.log.changed_at).getTime(),
    end: d.log.resolved_at ? new Date(d.log.resolved_at).getTime() : Date.now(),
  }));

  // Hourly ticks — every 2 hours to avoid crowding on small charts
  const allTicks: number[] = [];
  let tick = Math.floor(domainStart / 3_600_000) * 3_600_000;
  while (tick <= domainEnd) {
    allTicks.push(tick);
    tick += 3_600_000;
  }
  // Show every 2nd tick to prevent label collision
  const ticks = allTicks.filter((_, i) => i % 2 === 0);

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        Queue time tonight
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id={`grad-${history[0]?.attraction_id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            ticks={ticks}
            tickFormatter={formatHourLabel}
            tick={{ fontSize: 10, fill: '#475569' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            dataKey="wait"
            tick={false}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={0}
          />
          <Tooltip
            contentStyle={{ background: '#111111', border: '1px solid #2a2a2a', borderRadius: 6, fontSize: 12 }}
            labelFormatter={(v) => formatTooltipTime(v as number)}
            formatter={(v: unknown) => [`${v} min`, 'Wait time']}
            itemStyle={{ color: '#22C55E' }}
            labelStyle={{ color: '#888' }}
          />
          {/* Amber delay bands */}
          {delayBands.map((band, i) => (
            <ReferenceLine
              key={i}
              x={band.start}
              stroke="#f0ad4e"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              opacity={0.6}
            />
          ))}
          <Area
            type="monotone"
            dataKey="wait"
            stroke="#22C55E"
            strokeWidth={2}
            fill={`url(#grad-${history[0]?.attraction_id})`}
            connectNulls={false}
            dot={false}
            activeDot={{ r: 3, fill: '#22C55E' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Live delay timer ── */

function DelayTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(() =>
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <span style={{
      fontSize: 13,
      fontWeight: 700,
      color: '#f0ad4e',
      fontVariantNumeric: 'tabular-nums',
      letterSpacing: '0.03em',
    }}>
      {formatElapsed(elapsed)}
    </span>
  );
}

/* ── Ops Card ── */

function OpsCard({ ops, dateStr, openTime, closeTime }: { ops: AttractionOps; dateStr: string; openTime: string; closeTime: string }) {
  const { attraction, currentStatus, openedAt, closedAt, delays, totalDowntimeSecs, activeDelay, history, totalGuests, avgDispatchIntervalSecs, totalDispatches } = ops;

  const statusColor = STATUS_COLORS[currentStatus] || '#888';
  const statusBg = STATUS_BG[currentStatus] || 'rgba(128,128,128,0.15)';
  const logo = getAttractionLogo(attraction.slug);
  const glow = getLogoGlow(attraction.slug);

  return (
    <div style={{
      background: '#111111',
      border: '1px solid #2a2a2a',
      borderRadius: 14,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {logo && (
            <img src={logo} alt="" aria-hidden width={40} height={40}
              style={{ width: 40, height: 40, objectFit: 'contain', filter: glow || undefined }} />
          )}
          <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>{attraction.name}</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            background: statusBg,
            color: statusColor,
            border: `1px solid ${statusColor}40`,
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            {currentStatus}
          </span>
          {activeDelay && (
            <DelayTimer startedAt={activeDelay.changed_at} />
          )}
        </div>
      </div>

      {/* Quick stats row */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Opened</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: openedAt ? '#ccc' : '#555' }}>
            {openedAt ? formatTimestamp(openedAt) : 'Not yet opened'}
          </div>
        </div>
        {closedAt && (
          <div>
            <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Closed</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#ccc' }}>{formatTimestamp(closedAt)}</div>
          </div>
        )}
        <div>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Total downtime</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: totalDowntimeSecs > 0 ? '#f0ad4e' : '#555' }}>
            {totalDowntimeSecs > 0 ? formatElapsed(totalDowntimeSecs) : '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Delay incidents</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: delays.length > 0 ? '#f0ad4e' : '#555' }}>
            {delays.length > 0 ? delays.length : '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Total guests</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: totalGuests > 0 ? '#fff' : '#555' }}>
            {totalGuests > 0 ? totalGuests.toLocaleString() : '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Avg dispatch</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: avgDispatchIntervalSecs !== null ? '#fff' : '#555' }}>
            {avgDispatchIntervalSecs !== null
              ? avgDispatchIntervalSecs >= 60
                ? `${Math.floor(avgDispatchIntervalSecs / 60)}m ${avgDispatchIntervalSecs % 60}s`
                : `${avgDispatchIntervalSecs}s`
              : totalDispatches === 1 ? '1 dispatch' : '—'}
          </div>
        </div>
      </div>

      {/* Delay incidents */}
      {delays.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Delay log</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {delays.map((incident) => (
              <div
                key={incident.log.id}
                style={{
                  background: 'rgba(240,173,78,0.08)',
                  border: '1px solid rgba(240,173,78,0.2)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, color: '#f0ad4e', fontWeight: 600 }}>
                  {formatTimestamp(incident.log.changed_at)}
                </span>
                {incident.log.reason && (
                  <span style={{ fontSize: 12, color: '#aaa', background: '#1a1a1a', borderRadius: 4, padding: '2px 8px' }}>
                    {incident.log.reason}
                  </span>
                )}
                {incident.log.notes && (
                  <span style={{ fontSize: 12, color: '#777', fontStyle: 'italic', flex: 1, minWidth: 100 }}>
                    &ldquo;{incident.log.notes}&rdquo;
                  </span>
                )}
                <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                  {incident.durationSecs === null
                    ? <span style={{ color: '#f0ad4e', fontWeight: 700 }}>ongoing</span>
                    : formatElapsed(incident.durationSecs)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!openedAt && (
        <div style={{ fontSize: 13, color: '#555', fontStyle: 'italic' }}>No activity recorded today.</div>
      )}

      {/* Queue time chart */}
      {history.length > 0 && (
        <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: 16 }}>
          <QueueChart
            history={history}
            delays={delays}
            dateStr={dateStr}
            openTime={openTime}
            closeTime={closeTime}
          />
        </div>
      )}
    </div>
  );
}

/* ── Build ops data from logs ── */

function buildOpsData(
  attractions: Attraction[],
  logs: AttractionStatusLog[],
  history: AttractionHistory[],
  throughput: ThroughputLog[],
  dispatches: DispatchLog[],
): AttractionOps[] {
  return attractions.filter((a) => a.attraction_type === 'ride').map((attraction) => {
    const aLogs = logs.filter((l) => l.attraction_id === attraction.id);
    const aHistory = history.filter((h) => h.attraction_id === attraction.id);
    const totalGuests = throughput
      .filter((t) => t.attraction_id === attraction.id)
      .reduce((sum, t) => sum + (t.guest_count || 0), 0);

    // Average dispatch interval
    const aDispatches = dispatches
      .filter((d) => d.attraction_id === attraction.id)
      .sort((a, b) => new Date(a.dispatched_at).getTime() - new Date(b.dispatched_at).getTime());
    let avgDispatchIntervalSecs: number | null = null;
    if (aDispatches.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < aDispatches.length; i++) {
        intervals.push(
          (new Date(aDispatches[i].dispatched_at).getTime() - new Date(aDispatches[i - 1].dispatched_at).getTime()) / 1000
        );
      }
      avgDispatchIntervalSecs = Math.round(intervals.reduce((s, v) => s + v, 0) / intervals.length);
    }

    const firstOpen = aLogs.find((l) => l.status === 'OPEN') || null;
    const closedLogs = aLogs.filter((l) => l.status === 'CLOSED');
    const lastClosed = closedLogs.length > 0 ? closedLogs[closedLogs.length - 1] : null;
    // Only show closing time if it happened after today's opening — prevents
    // late-night close events from the previous night appearing as today's close
    const validLastClosed = lastClosed && firstOpen
      && new Date(lastClosed.changed_at) > new Date(firstOpen.changed_at)
      ? lastClosed : null;

    const delayLogs = aLogs.filter((l) => l.status === 'DELAYED');
    const delays: DelayIncident[] = delayLogs.map((log) => {
      const endTime = log.resolved_at || null;
      const durationSecs = endTime
        ? Math.floor((new Date(endTime).getTime() - new Date(log.changed_at).getTime()) / 1000)
        : null;
      return { log, durationSecs };
    });

    const totalDowntimeSecs = delays.reduce((acc, d) => acc + (d.durationSecs ?? 0), 0);
    const activeDelay = delayLogs.find((l) => l.resolved_at === null) || null;

    return {
      attraction,
      currentStatus: attraction.status as AttractionStatus,
      openedAt: firstOpen?.changed_at || null,
      closedAt: validLastClosed?.changed_at || null,
      delays,
      totalDowntimeSecs,
      activeDelay,
      history: aHistory,
      totalGuests,
      avgDispatchIntervalSecs,
      totalDispatches: aDispatches.length,
    };
  });
}

/* ── Main page ── */

export default function OperationsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [logs, setLogs] = useState<AttractionStatusLog[]>([]);
  const [history, setHistory] = useState<AttractionHistory[]>([]);
  const [throughput, setThroughput] = useState<ThroughputLog[]>([]);
  const [dispatches, setDispatches] = useState<DispatchLog[]>([]);
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [selectedDate, setSelectedDate] = useState(getTodayDateStr());
  const [opsData, setOpsData] = useState<AttractionOps[]>([]);

  const fetchData = useCallback(async (dateStr: string) => {
    const start = new Date(`${dateStr}T00:00:00`).toISOString();
    const end   = new Date(`${dateStr}T23:59:59`).toISOString();

    const [attractionsRes, allLogs, historyRes, throughputRes, dispatchRes, openRes, closeRes] = await Promise.all([
      supabase.from('attractions').select('*').order('sort_order', { ascending: true }),
      getAllStatusLogs(dateStr),
      supabase
        .from('attraction_history')
        .select('id,attraction_id,attraction_name,status,wait_time,recorded_at')
        .gte('recorded_at', start)
        .lte('recorded_at', end)
        .order('recorded_at', { ascending: true }),
      supabase.from('throughput_logs').select('*').eq('log_date', dateStr),
      supabase.from('dispatch_logs').select('*').eq('log_date', dateStr).order('dispatched_at', { ascending: true }),
      supabase.from('park_settings').select('value').eq('key', 'opening_time').single(),
      supabase.from('park_settings').select('value').eq('key', 'closing_time').single(),
    ]);

    const attrs: Attraction[] = attractionsRes.data || [];
    const hist: AttractionHistory[] = historyRes.data || [];
    const tp: ThroughputLog[] = throughputRes.data || [];
    const dp: DispatchLog[] = dispatchRes.data || [];

    setAttractions(attrs);
    setLogs(allLogs);
    setHistory(hist);
    setThroughput(tp);
    setDispatches(dp);
    setOpenTime(openRes.data?.value || '');
    setCloseTime(closeRes.data?.value || '');
    setOpsData(buildOpsData(attrs, allLogs, hist, tp, dp));
  }, []);

  useEffect(() => {
    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || auth.role !== 'admin') {
        router.push('/admin/login');
        return;
      }
      setUserEmail(auth.email || '');
      setDisplayName(auth.displayName || '');
      await fetchData(selectedDate);
      setLoading(false);
    }
    init();
  }, []);

  // Re-fetch when date changes
  useEffect(() => {
    if (!loading) fetchData(selectedDate);
  }, [selectedDate]);

  // Rebuild opsData when any source data updates
  useEffect(() => {
    setOpsData(buildOpsData(attractions, logs, history, throughput, dispatches));
  }, [attractions, logs, history, throughput]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('ops-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attraction_status_logs' },
        () => { fetchData(selectedDate); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'throughput_logs' },
        () => { fetchData(selectedDate); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_logs' },
        () => { fetchData(selectedDate); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attractions' },
        (payload) => {
          setAttractions((prev) =>
            prev.map((a) => (a.id === (payload.new as Attraction).id ? (payload.new as Attraction) : a))
          );
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedDate, fetchData]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/admin/login');
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#94A3B8', fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  const isToday = selectedDate === getTodayDateStr();

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a' }}>
      <AdminNav userEmail={userEmail} displayName={displayName} onLogout={handleLogout} />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0 }}>Operations</h1>
            <p style={{ color: '#94A3B8', fontSize: 13, margin: '4px 0 0' }}>
              {isToday ? "Tonight's operational picture" : `Operational picture for ${selectedDate}`}
            </p>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              background: '#111111',
              border: '1px solid #2a2a2a',
              color: '#F1F5F9',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 14,
              outline: 'none',
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {opsData.map((ops) => (
            <OpsCard key={ops.attraction.id} ops={ops} dateStr={selectedDate} openTime={openTime} closeTime={closeTime} />
          ))}
          {opsData.length === 0 && (
            <div style={{ color: '#555', fontSize: 14, textAlign: 'center', padding: '48px 0' }}>
              No attractions found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
