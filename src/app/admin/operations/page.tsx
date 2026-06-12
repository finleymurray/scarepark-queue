'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { checkAuth, clearAuthCache } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import { getAllStatusLogs } from '@/lib/statusLog';
import { getAttractionLogo, getLogoGlow } from '@/lib/logos';
import type { Attraction, AttractionHistory, AttractionStatus, AttractionStatusLog, ThroughputLog, DispatchLog, OperatorSession, AuditLog } from '@/types/database';
import { surface, border, text, radius, card, microLabel, FONT_NUM, statusColors, accents, controlButton } from '@/lib/theme';
import MetricStat from '@/components/ui/MetricStat';
import { useToasts, ToastStack } from '@/components/ui/Toast';
import type { DelayIncident } from './QueueChart';

// Recharts is ~300KB — load the chart from an async chunk so the page
// renders without paying for it up front.
const QueueChart = dynamic(() => import('./QueueChart'), {
  ssr: false,
  loading: () => <div style={{ height: 204, background: surface.card }} />,
});

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

/* ── Per-attraction data structures ── */

interface HourlySlot {
  start: string; // "19:00"
  end: string;   // "20:00"
  guests: number;
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
  avgDispatchIntervalSecs: number | null;
  totalDispatches: number;
  hourlyBreakdown: HourlySlot[];
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

/* ── Operator timeline ── */

function formatHM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function operatorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function OperatorTimeline({
  sessions,
  dispatches,
  queueAudits,
}: {
  sessions: OperatorSession[];
  dispatches: DispatchLog[];
  queueAudits: AuditLog[];
}) {
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  );

  return (
    <div style={{ borderTop: `1px solid ${border.divider}`, paddingTop: 16 }}>
      <div style={{ ...microLabel, marginBottom: 12 }}>Operators</div>

      {sorted.length === 0 ? (
        <div style={{ color: text.faint, fontSize: 11 }}>No operator sessions logged</div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Vertical connector line */}
          {sorted.length > 1 && (
            <div style={{ position: 'absolute', left: 11, top: 12, bottom: 12, width: 2, background: border.divider }} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {sorted.map((session) => {
              const active = session.ended_at === null;
              const windowStart = new Date(session.started_at).getTime();
              const windowEnd = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();

              const sessionDispatches = dispatches.filter((d) => {
                if (d.dispatched_by !== session.operator_name) return false;
                const t = new Date(d.dispatched_at).getTime();
                return t >= windowStart && t <= windowEnd;
              });
              const guests = sessionDispatches.reduce((s, d) => s + d.group_size, 0);

              const queueChanges = queueAudits.filter((a) => {
                if (a.performed_by !== session.operator_name) return false;
                const t = new Date(a.created_at).getTime();
                return t >= windowStart && t <= windowEnd;
              }).length;

              return (
                <div key={session.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', position: 'relative' }}>
                  {/* Avatar */}
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    flexShrink: 0,
                    border: `3px solid ${surface.card}`,
                    background: active ? accents.control.strong : '#374151',
                    color: active ? '#fff' : '#CBD5E1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    zIndex: 1,
                  }}>
                    {operatorInitials(session.operator_name)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{
                        color: active ? text.primary : text.secondary,
                        fontSize: 12,
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {session.operator_name}
                      </span>
                      <span style={{
                        color: active ? '#4ADE80' : text.muted,
                        fontSize: 11,
                        whiteSpace: 'nowrap',
                        ...FONT_NUM,
                      }}>
                        {formatHM(session.started_at)} — {session.ended_at ? formatHM(session.ended_at) : 'now'}
                      </span>
                    </div>
                    <div style={{ color: text.muted, fontSize: 11, marginTop: 2 }}>
                      {guests} guests · {sessionDispatches.length} dispatches · {queueChanges} queue changes
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Ops Card ── */

function OpsCard({ ops, dateStr, openTime, closeTime, sessions, dispatches, queueAudits }: { ops: AttractionOps; dateStr: string; openTime: string; closeTime: string; sessions: OperatorSession[]; dispatches: DispatchLog[]; queueAudits: AuditLog[] }) {
  const { attraction, currentStatus, openedAt, closedAt, delays, totalDowntimeSecs, activeDelay, history, totalGuests, avgDispatchIntervalSecs, totalDispatches, hourlyBreakdown } = ops;

  const sc = statusColors(currentStatus);
  const logo = getAttractionLogo(attraction.slug);
  const glow = getLogoGlow(attraction.slug);

  return (
    <div style={{
      ...card(currentStatus),
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
          <h3 style={{ color: text.primary, fontSize: 18, fontWeight: 700, margin: 0 }}>{attraction.name}</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            background: sc.soft,
            color: sc.text,
            border: `1px solid ${sc.rail}40`,
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
        <MetricStat label="Opened" size={15}
          value={openedAt ? formatTimestamp(openedAt) : 'Not yet opened'}
          color={openedAt ? text.secondary : text.faint} />
        {closedAt && (
          <MetricStat label="Closed" size={15} value={formatTimestamp(closedAt)} color={text.secondary} />
        )}
        <MetricStat label="Total downtime" size={15}
          value={totalDowntimeSecs > 0 ? formatElapsed(totalDowntimeSecs) : '—'}
          color={totalDowntimeSecs > 0 ? '#FBBF24' : text.faint} />
        <MetricStat label="Delay incidents" size={15}
          value={delays.length > 0 ? delays.length : '—'}
          color={delays.length > 0 ? '#FBBF24' : text.faint} />
        <MetricStat label="Total guests" size={15}
          value={totalGuests > 0 ? totalGuests.toLocaleString() : '—'}
          color={totalGuests > 0 ? text.primary : text.faint} />
        <MetricStat label="Avg dispatch" size={15}
          value={avgDispatchIntervalSecs !== null
            ? avgDispatchIntervalSecs >= 60
              ? `${Math.floor(avgDispatchIntervalSecs / 60)}m ${avgDispatchIntervalSecs % 60}s`
              : `${avgDispatchIntervalSecs}s`
            : totalDispatches === 1 ? '1 dispatch' : '—'}
          color={avgDispatchIntervalSecs !== null ? text.primary : text.faint} />
      </div>

      {/* Delay incidents */}
      {delays.length > 0 && (
        <div>
          <div style={{ ...microLabel, marginBottom: 8 }}>Delay log</div>
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
                  <span style={{ fontSize: 12, color: text.secondary, background: surface.raised, borderRadius: 4, padding: '2px 8px' }}>
                    {incident.log.reason}
                  </span>
                )}
                {incident.log.notes && (
                  <span style={{ fontSize: 12, color: text.muted, fontStyle: 'italic', flex: 1, minWidth: 100 }}>
                    &ldquo;{incident.log.notes}&rdquo;
                  </span>
                )}
                <span style={{ fontSize: 12, color: text.muted, marginLeft: 'auto', whiteSpace: 'nowrap', ...FONT_NUM }}>
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
        <div style={{ fontSize: 13, color: text.faint, fontStyle: 'italic' }}>No activity recorded today.</div>
      )}

      {/* Hourly Throughput */}
      {hourlyBreakdown.length > 0 && (
        <div style={{ borderTop: `1px solid ${border.divider}`, paddingTop: 16, marginBottom: 8 }}>
          <div style={{ ...microLabel, marginBottom: 10 }}>
            Hourly Throughput
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {hourlyBreakdown.map((slot) => {
              const [sh, sm] = slot.start.split(':').map(Number);
              const [eh, em] = slot.end.split(':').map(Number);
              const startAmpm = sh >= 12 ? 'PM' : 'AM';
              const endAmpm   = eh >= 12 ? 'PM' : 'AM';
              const sh12 = sh === 0 ? 12 : sh > 12 ? sh - 12 : sh;
              const eh12 = eh === 0 ? 12 : eh > 12 ? eh - 12 : eh;
              const startStr = `${sh12}:${String(sm).padStart(2,'0')} ${startAmpm}`;
              const endStr   = `${eh12}:${String(em).padStart(2,'0')} ${endAmpm}`;
              return (
                <div key={slot.start} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', background: surface.control, borderRadius: radius.sm }}>
                  <span style={{ color: text.secondary, fontSize: 13 }}>{startStr} – {endStr}</span>
                  <span style={{ color: slot.guests > 0 ? text.primary : text.faint, fontSize: 13, fontWeight: slot.guests > 0 ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}>
                    {slot.guests > 0 ? `${slot.guests} guests` : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Queue time chart */}
      {history.length > 0 && (
        <div style={{ borderTop: `1px solid ${border.divider}`, paddingTop: 16 }}>
          <QueueChart
            history={history}
            delays={delays}
            dateStr={dateStr}
            openTime={openTime}
            closeTime={closeTime}
          />
        </div>
      )}

      {/* Operator timeline */}
      <OperatorTimeline sessions={sessions} dispatches={dispatches} queueAudits={queueAudits} />
    </div>
  );
}

/* ── Build ops data from logs ── */

/* ── Slot helpers ── */
function genSlots(openTime: string, closeTime: string, dateStr: string): HourlySlot[] {
  if (!openTime || !closeTime) return [];
  const [oh] = openTime.split(':').map(Number);
  const [ch, cm] = closeTime.split(':').map(Number);
  let start = oh * 60;
  let end = ch * 60 + (cm || 0);
  if (end <= start) end += 24 * 60;
  end += 60; // 1hr buffer
  const slots: HourlySlot[] = [];
  let cursor = start;
  while (cursor < end) {
    const next = Math.min(cursor + 60, end);
    const sh = Math.floor(cursor / 60) % 24, sm = cursor % 60;
    const eh = Math.floor(next / 60) % 24, em = next % 60;
    slots.push({
      start: `${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}`,
      end:   `${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}`,
      guests: 0,
    });
    cursor = next;
  }
  return slots;
}

function buildOpsData(
  attractions: Attraction[],
  logs: AttractionStatusLog[],
  history: AttractionHistory[],
  throughput: ThroughputLog[],
  dispatches: DispatchLog[],
  openTime: string,
  closeTime: string,
  dateStr: string,
): AttractionOps[] {
  return attractions.filter((a) => a.attraction_type === 'ride').map((attraction) => {
    const aLogs = logs.filter((l) => l.attraction_id === attraction.id);
    const aHistory = history.filter((h) => h.attraction_id === attraction.id);

    // Build hourly breakdown: prefer throughput_logs manual overrides,
    // otherwise sum dispatch_logs per slot. Always re-computed on every call.
    const slots = genSlots(openTime, closeTime, dateStr);
    const hourlyBreakdown: HourlySlot[] = slots.map((slot) => {
      // Manual override from throughput_logs takes priority
      const manual = throughput.find(
        (t) => t.attraction_id === attraction.id && t.slot_start === slot.start && t.slot_end === slot.end
      );
      if (manual) return { ...slot, guests: manual.guest_count };
      // Sum dispatches that fall within this slot
      const slotStart = new Date(`${dateStr}T${slot.start}:00`).getTime();
      const slotEnd   = new Date(`${dateStr}T${slot.end}:00`).getTime();
      const guests = dispatches
        .filter((d) => {
          if (d.attraction_id !== attraction.id) return false;
          const t = new Date(d.dispatched_at).getTime();
          return t >= slotStart && t < slotEnd;
        })
        .reduce((s, d) => s + d.group_size, 0);
      return { ...slot, guests };
    });

    // Total guests = sum of hourly breakdown
    const totalGuests = hourlyBreakdown.reduce((s, sl) => s + sl.guests, 0);

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
      hourlyBreakdown,
    };
  });
}

/* ── Main page ── */

export default function OperationsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [logs, setLogs] = useState<AttractionStatusLog[]>([]);
  const [history, setHistory] = useState<AttractionHistory[]>([]);
  const [throughput, setThroughput] = useState<ThroughputLog[]>([]);
  const [dispatches, setDispatches] = useState<DispatchLog[]>([]);
  const [operatorSessions, setOperatorSessions] = useState<OperatorSession[]>([]);
  const [queueAudits, setQueueAudits] = useState<AuditLog[]>([]);
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [selectedDate, setSelectedDate] = useState(getTodayDateStr());
  const [opsData, setOpsData] = useState<AttractionOps[]>([]);
  const { toasts, pushToast } = useToasts();

  const fetchData = useCallback(async (dateStr: string) => {
    const start = new Date(`${dateStr}T00:00:00`).toISOString();
    const end   = new Date(`${dateStr}T23:59:59`).toISOString();

    const [attractionsRes, allLogs, historyRes, throughputRes, dispatchRes, openRes, closeRes, sessionsRes, auditRes] = await Promise.all([
      supabase.from('attractions').select('id,name,slug,status,wait_time,sort_order,attraction_type,target_dispatch_seconds').order('sort_order', { ascending: true }),
      getAllStatusLogs(dateStr),
      supabase
        .from('attraction_history')
        .select('id,attraction_id,attraction_name,status,wait_time,recorded_at')
        .gte('recorded_at', start)
        .lte('recorded_at', end)
        .order('recorded_at', { ascending: true }),
      supabase.from('throughput_logs').select('id,attraction_id,slot_start,slot_end,guest_count,log_date').eq('log_date', dateStr),
      supabase.from('dispatch_logs').select('*').eq('log_date', dateStr).order('dispatched_at', { ascending: true }),
      supabase.from('park_settings').select('value').eq('key', 'opening_time').single(),
      supabase.from('park_settings').select('value').eq('key', 'closing_time').single(),
      supabase.from('operator_sessions').select('id,attraction_id,operator_name,started_at,ended_at,log_date').eq('log_date', dateStr).order('started_at', { ascending: false }),
      supabase
        .from('audit_logs')
        .select('id,action_type,attraction_id,attraction_name,performed_by,old_value,new_value,details,created_at')
        .eq('action_type', 'queue_time_change')
        .gte('created_at', start)
        .lte('created_at', end),
    ]);

    if (attractionsRes.error || historyRes.error || throughputRes.error || dispatchRes.error) {
      pushToast('error', 'Failed to load operations data');
    }

    const attrs: Attraction[] = (attractionsRes.data as Attraction[]) || [];
    const hist: AttractionHistory[] = historyRes.data || [];
    const tp: ThroughputLog[] = (throughputRes.data as ThroughputLog[]) || [];
    const dp: DispatchLog[] = dispatchRes.data || [];

    setAttractions(attrs);
    setLogs(allLogs);
    setHistory(hist);
    setThroughput(tp);
    setDispatches(dp);
    setOperatorSessions((sessionsRes.data as OperatorSession[]) || []);
    setQueueAudits((auditRes.data as AuditLog[]) || []);
    setOpenTime(openRes.data?.value || '');
    setCloseTime(closeRes.data?.value || '');
    setOpsData(buildOpsData(attrs, allLogs, hist, tp, dp, openRes.data?.value || '', closeRes.data?.value || '', dateStr));
  }, [pushToast]);

  useEffect(() => {
    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || auth.role !== 'admin') {
        window.location.href = '/admin/login';
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
    setOpsData(buildOpsData(attractions, logs, history, throughput, dispatches, openTime, closeTime, selectedDate));
  }, [attractions, logs, history, throughput, dispatches, openTime, closeTime, selectedDate]);

  // Realtime subscription — debounce bursts of events into a single fetch
  const refetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const scheduleFetch = () => {
      if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current);
      refetchTimeoutRef.current = setTimeout(() => {
        refetchTimeoutRef.current = null;
        fetchData(selectedDate);
      }, 2000);
    };

    const channel = supabase
      .channel('ops-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attraction_status_logs' },
        () => { scheduleFetch(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'throughput_logs' },
        () => { scheduleFetch(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_logs' },
        () => { scheduleFetch(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'operator_sessions' },
        () => { scheduleFetch(); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attractions' },
        (payload) => {
          setAttractions((prev) =>
            prev.map((a) => (a.id === (payload.new as Attraction).id ? (payload.new as Attraction) : a))
          );
        })
      .subscribe();

    return () => {
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current);
        refetchTimeoutRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [selectedDate, fetchData]);

  async function handleLogout() {
    clearAuthCache(); await supabase.auth.signOut();
    window.location.href = '/admin/login';
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: surface.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: text.secondary, fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  const isToday = selectedDate === getTodayDateStr();

  return (
    <div style={{ minHeight: '100vh', background: surface.page }}>
      <AdminNav userEmail={userEmail} displayName={displayName} onLogout={handleLogout} />
      <ToastStack toasts={toasts} />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: text.primary, fontSize: 22, fontWeight: 700, margin: 0 }}>Operations</h1>
            <p style={{ color: text.secondary, fontSize: 13, margin: '4px 0 0' }}>
              {isToday ? "Tonight's operational picture" : `Operational picture for ${selectedDate}`}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={async () => {
                setRefreshing(true);
                try {
                  await fetchData(selectedDate);
                } finally {
                  setRefreshing(false);
                }
              }}
              disabled={refreshing}
              title="Refresh data"
              style={{
                ...controlButton,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                fontSize: 14,
                fontWeight: 600,
                opacity: refreshing ? 0.5 : 1,
              }}
            >
              <svg
                width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
                style={refreshing ? { animation: 'ops-spin 0.8s linear infinite' } : undefined}
              >
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <style>{`@keyframes ops-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                background: surface.control,
                border: `1px solid ${border.strong}`,
                color: text.primary,
                borderRadius: radius.md,
                padding: '10px 14px',
                fontSize: 14,
                outline: 'none',
                cursor: 'pointer',
                ...FONT_NUM,
              }}
            />
            {/* Plain <a> (not next/link) for static-export reliability */}
            <a
              href={`/admin/operations/print?date=${selectedDate}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...controlButton,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print Report
            </a>
          </div>
        </div>

        {/* Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {opsData.map((ops) => (
            <OpsCard
              key={ops.attraction.id}
              ops={ops}
              dateStr={selectedDate}
              openTime={openTime}
              closeTime={closeTime}
              sessions={operatorSessions.filter((s) => s.attraction_id === ops.attraction.id)}
              dispatches={dispatches.filter((d) => d.attraction_id === ops.attraction.id)}
              queueAudits={queueAudits.filter((a) => a.attraction_id === ops.attraction.id)}
            />
          ))}
          {opsData.length === 0 && (
            <div style={{ color: text.faint, fontSize: 14, textAlign: 'center', padding: '48px 0' }}>
              No attractions found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
