'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import { getAllStatusLogs } from '@/lib/statusLog';
import type {
  Attraction,
  AttractionHistory,
  AttractionStatusLog,
  ThroughputLog,
  DispatchLog,
  OperatorSession,
} from '@/types/database';

/* ── Formatting helpers (mirrored from reports/print + operations page) ── */

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}

function formatTime(timeStr: string): string {
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${ampm}`;
}

function formatTs(ts: string): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m} ${ampm}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatSecs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

/* ── Ops computation (copied from src/app/admin/operations/page.tsx) ── */

interface DelayIncident {
  log: AttractionStatusLog;
  durationSecs: number | null; // null = ongoing
}

interface HourlySlot {
  start: string;
  end: string;
  guests: number;
}

interface AttractionOps {
  attraction: Attraction;
  openedAt: string | null;
  closedAt: string | null;
  delays: DelayIncident[];
  totalDowntimeSecs: number;
  history: AttractionHistory[];
  totalGuests: number;
  avgDispatchIntervalSecs: number | null;
  totalDispatches: number;
  hourlyBreakdown: HourlySlot[];
  operatingMinutes: number | null;
  waitStats: { min: number; avg: number; max: number; peakAt: string | null } | null;
}

function hhmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

function dateToMin(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function genSlots(openTime: string, closeTime: string): HourlySlot[] {
  if (!openTime || !closeTime) return [];
  const [oh] = openTime.split(':').map(Number);
  const [ch, cm] = closeTime.split(':').map(Number);
  const start = oh * 60;
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
      start: `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`,
      end: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`,
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

    // Hourly breakdown: throughput_logs manual overrides win, else sum dispatch_logs per slot
    const slots = genSlots(openTime, closeTime);
    const hourlyBreakdown: HourlySlot[] = slots.map((slot) => {
      const manual = throughput.find(
        (t) => t.attraction_id === attraction.id && t.slot_start === slot.start && t.slot_end === slot.end
      );
      if (manual) return { ...slot, guests: manual.guest_count };
      const slotStart = new Date(`${dateStr}T${slot.start}:00`).getTime();
      const slotEnd = new Date(`${dateStr}T${slot.end}:00`).getTime();
      const guests = dispatches
        .filter((d) => {
          if (d.attraction_id !== attraction.id) return false;
          const t = new Date(d.dispatched_at).getTime();
          return t >= slotStart && t < slotEnd;
        })
        .reduce((s, d) => s + d.group_size, 0);
      return { ...slot, guests };
    });

    const totalGuests = hourlyBreakdown.reduce((s, sl) => s + sl.guests, 0);

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

    // Operating minutes: actual opened→closed window, falling back to park hours
    let operatingMinutes: number | null = null;
    if (firstOpen && validLastClosed) {
      operatingMinutes = Math.round(
        (new Date(validLastClosed.changed_at).getTime() - new Date(firstOpen.changed_at).getTime()) / 60000
      );
    } else if (openTime && closeTime) {
      let mins = hhmToMin(closeTime) - hhmToMin(openTime);
      if (mins <= 0) mins += 24 * 60;
      operatingMinutes = mins;
    }

    // Queue time stats from attraction_history within the operating window
    let domainStart: number | null = null;
    let domainEnd: number | null = null;
    if (openTime && closeTime) {
      domainStart = Math.floor(hhmToMin(openTime) / 60) * 60;
      domainEnd = hhmToMin(closeTime) + 60;
      if (domainEnd <= domainStart) domainEnd += 24 * 60;
    }
    const waitRecords = aHistory.filter((h) => {
      if (h.status !== 'OPEN' && h.status !== 'AT CAPACITY') return false;
      if (domainStart === null || domainEnd === null) return true;
      const min = dateToMin(new Date(h.recorded_at));
      return min >= domainStart && min <= domainEnd;
    });
    let waitStats: AttractionOps['waitStats'] = null;
    if (waitRecords.length > 0) {
      const waits = waitRecords.map((h) => h.wait_time);
      const max = Math.max(...waits);
      const peak = waitRecords.find((h) => h.wait_time === max) || null;
      waitStats = {
        min: Math.min(...waits),
        avg: Math.round(waits.reduce((s, v) => s + v, 0) / waits.length),
        max,
        peakAt: peak ? peak.recorded_at : null,
      };
    }

    return {
      attraction,
      openedAt: firstOpen?.changed_at || null,
      closedAt: validLastClosed?.changed_at || null,
      delays,
      totalDowntimeSecs,
      history: aHistory,
      totalGuests,
      avgDispatchIntervalSecs,
      totalDispatches: aDispatches.length,
      hourlyBreakdown,
      operatingMinutes,
      waitStats,
    };
  });
}

/* ── Single attraction page ── */

function OpsReportPage({
  ops,
  dateStr,
  sessions,
  dispatches,
  isLast,
}: {
  ops: AttractionOps;
  dateStr: string;
  sessions: OperatorSession[];
  dispatches: DispatchLog[];
  isLast: boolean;
}) {
  const { attraction, delays, totalDowntimeSecs, totalGuests, avgDispatchIntervalSecs, totalDispatches, hourlyBreakdown, operatingMinutes, waitStats } = ops;

  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  );

  return (
    <table className="report-page" style={{ pageBreakAfter: isLast ? 'avoid' : 'always', breakAfter: isLast ? 'avoid' : 'page' }}>

      {/* Running header — repeats on every continuation page */}
      <thead>
        <tr>
          <td className="running-header-cell">
            <div className="running-header-inner">
              <span className="running-header-name">{attraction.name}</span>
              <span className="running-header-meta">Operations Report · {formatDate(dateStr)}</span>
            </div>
            <div className="running-rule" />
          </td>
        </tr>
      </thead>

      {/* Running footer */}
      <tfoot>
        <tr>
          <td className="running-footer-cell">
            <div className="running-footer-inner">
              <span>Immersive Core — Confidential</span>
              <span>{attraction.name} · {formatDate(dateStr)}</span>
            </div>
          </td>
        </tr>
      </tfoot>

      <tbody>
        <tr>
          <td className="report-body-cell">

            {/* ── First-page header (logo, IC branding, date) ── */}
            <div className="page-header" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <div className="page-header-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-print.png" alt="Immersive Core" className="header-logo" />
                <div>
                  <div className="header-company">Immersive Core</div>
                  <div className="header-doc-type">Operations Report</div>
                </div>
              </div>
              <div className="page-header-right">
                <div className="header-date">{formatDate(dateStr)}</div>
                <div className="header-submitted">
                  {ops.openedAt ? `Opened ${formatTs(ops.openedAt)}` : 'Not opened'}
                  {ops.closedAt ? ` · Closed ${formatTs(ops.closedAt)}` : ''}
                </div>
              </div>
            </div>

            <div className="header-rule" />
            <h1 className="attraction-title">{attraction.name}</h1>

            {/* ── Key stats row ── */}
            <div className="stats-row">
              <div className="stat-box">
                <div className="stat-label">Total Guests</div>
                <div className="stat-value">{totalGuests.toLocaleString()}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Dispatches</div>
                <div className="stat-value">{totalDispatches.toLocaleString()}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Avg Dispatch</div>
                <div className="stat-value">{avgDispatchIntervalSecs !== null ? formatSecs(avgDispatchIntervalSecs) : '—'}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Peak Queue</div>
                <div className="stat-value">{waitStats ? `${waitStats.max} min` : '—'}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Operating</div>
                <div className="stat-value">{operatingMinutes !== null ? formatMinutes(operatingMinutes) : '—'}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Downtime</div>
                <div className="stat-value" style={{ color: totalDowntimeSecs > 0 ? '#c0392b' : undefined }}>
                  {totalDowntimeSecs > 0 ? formatMinutes(Math.round(totalDowntimeSecs / 60)) : '—'}
                </div>
              </div>
            </div>

            {/* ── Hourly Throughput ── */}
            <div className="section">
              <h2 className="section-title">Hourly Throughput</h2>
              {hourlyBreakdown.length === 0 ? (
                <p className="empty-text">No operating hours configured.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>Hour</th><th className="text-right">Guests</th></tr>
                  </thead>
                  <tbody>
                    {hourlyBreakdown.map((slot) => (
                      <tr key={slot.start}>
                        <td>{formatTime(slot.start)} – {formatTime(slot.end)}</td>
                        <td className="text-right font-bold">{slot.guests > 0 ? slot.guests : '—'}</td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td className="font-bold">Total</td>
                      <td className="text-right font-bold">{totalGuests.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Delay Log ── */}
            <div className="section">
              <h2 className="section-title">Delay Log</h2>
              {delays.length === 0 ? (
                <p className="empty-text">No delays recorded.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>Time</th><th className="text-right">Duration</th><th>Reason</th><th>Notes</th></tr>
                  </thead>
                  <tbody>
                    {delays.map((d) => (
                      <tr key={d.log.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {formatTs(d.log.changed_at)}{d.log.resolved_at ? ` – ${formatTs(d.log.resolved_at)}` : ' (unresolved)'}
                        </td>
                        <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                          {d.durationSecs !== null ? formatMinutes(Math.max(1, Math.round(d.durationSecs / 60))) : 'ongoing'}
                        </td>
                        <td>{d.log.reason || '—'}</td>
                        <td style={{ color: '#555', fontStyle: d.log.notes ? 'normal' : 'italic' }}>{d.log.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Operator Sessions ── */}
            <div className="section">
              <h2 className="section-title">Operator Sessions</h2>
              {sortedSessions.length === 0 ? (
                <p className="empty-text">No operator sessions logged.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>Operator</th><th>Start</th><th>End</th><th className="text-right">Dispatches</th><th className="text-right">Guests</th></tr>
                  </thead>
                  <tbody>
                    {sortedSessions.map((session) => {
                      const windowStart = new Date(session.started_at).getTime();
                      const windowEnd = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();
                      const sessionDispatches = dispatches.filter((d) => {
                        if (d.dispatched_by !== session.operator_name) return false;
                        const t = new Date(d.dispatched_at).getTime();
                        return t >= windowStart && t <= windowEnd;
                      });
                      const guests = sessionDispatches.reduce((s, d) => s + d.group_size, 0);
                      return (
                        <tr key={session.id}>
                          <td style={{ fontWeight: 600 }}>{session.operator_name}</td>
                          <td>{formatTs(session.started_at)}</td>
                          <td>{session.ended_at ? formatTs(session.ended_at) : '— (active)'}</td>
                          <td className="text-right">{sessionDispatches.length}</td>
                          <td className="text-right font-bold">{guests}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Queue Time Summary ── */}
            <div className="section">
              <h2 className="section-title">Queue Time Summary</h2>
              {!waitStats ? (
                <p className="empty-text">No queue time data recorded within the operating window.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>Minimum Wait</th><th>Average Wait</th><th>Maximum Wait</th><th>Peak Recorded At</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{waitStats.min} min</td>
                      <td>{waitStats.avg} min</td>
                      <td className="font-bold">{waitStats.max} min</td>
                      <td>{waitStats.peakAt ? formatTs(waitStats.peakAt) : '—'}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

          </td>
        </tr>
      </tbody>
    </table>
  );
}

/* ── Park-wide summary page ── */

function SummaryPage({ opsData, dateStr, openTime, closeTime }: { opsData: AttractionOps[]; dateStr: string; openTime: string; closeTime: string }) {
  const totalGuests = opsData.reduce((s, o) => s + o.totalGuests, 0);
  const totalDispatches = opsData.reduce((s, o) => s + o.totalDispatches, 0);
  const totalDowntimeSecs = opsData.reduce((s, o) => s + o.totalDowntimeSecs, 0);
  const totalDelays = opsData.reduce((s, o) => s + o.delays.length, 0);

  return (
    <table className="report-page" style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
      <thead>
        <tr>
          <td className="running-header-cell">
            <div className="running-header-inner">
              <span className="running-header-name">Park Summary</span>
              <span className="running-header-meta">Operations Report · {formatDate(dateStr)}</span>
            </div>
            <div className="running-rule" />
          </td>
        </tr>
      </thead>
      <tfoot>
        <tr>
          <td className="running-footer-cell">
            <div className="running-footer-inner">
              <span>Immersive Core — Confidential</span>
              <span>Park Summary · {formatDate(dateStr)}</span>
            </div>
          </td>
        </tr>
      </tfoot>
      <tbody>
        <tr>
          <td className="report-body-cell">
            <div className="page-header" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <div className="page-header-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-print.png" alt="Immersive Core" className="header-logo" />
                <div>
                  <div className="header-company">Immersive Core</div>
                  <div className="header-doc-type">Operations Report</div>
                </div>
              </div>
              <div className="page-header-right">
                <div className="header-date">{formatDate(dateStr)}</div>
                {openTime && closeTime && (
                  <div className="header-submitted">Park hours {formatTime(openTime)} – {formatTime(closeTime)}</div>
                )}
              </div>
            </div>

            <div className="header-rule" />
            <h1 className="attraction-title">Park Summary</h1>

            <div className="stats-row">
              <div className="stat-box">
                <div className="stat-label">Total Guests</div>
                <div className="stat-value">{totalGuests.toLocaleString()}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Total Dispatches</div>
                <div className="stat-value">{totalDispatches.toLocaleString()}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Delay Incidents</div>
                <div className="stat-value" style={{ color: totalDelays > 0 ? '#c0392b' : undefined }}>{totalDelays}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Total Downtime</div>
                <div className="stat-value" style={{ color: totalDowntimeSecs > 0 ? '#c0392b' : undefined }}>
                  {totalDowntimeSecs > 0 ? formatMinutes(Math.round(totalDowntimeSecs / 60)) : '—'}
                </div>
              </div>
            </div>

            <div className="section">
              <h2 className="section-title">By Attraction</h2>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Attraction</th>
                    <th className="text-right">Guests</th>
                    <th className="text-right">Dispatches</th>
                    <th className="text-right">Avg Dispatch</th>
                    <th className="text-right">Peak Queue</th>
                    <th className="text-right">Delays</th>
                    <th className="text-right">Downtime</th>
                  </tr>
                </thead>
                <tbody>
                  {opsData.map((o) => (
                    <tr key={o.attraction.id}>
                      <td className="font-bold">{o.attraction.name}</td>
                      <td className="text-right">{o.totalGuests.toLocaleString()}</td>
                      <td className="text-right">{o.totalDispatches}</td>
                      <td className="text-right">{o.avgDispatchIntervalSecs !== null ? formatSecs(o.avgDispatchIntervalSecs) : '—'}</td>
                      <td className="text-right">{o.waitStats ? `${o.waitStats.max} min` : '—'}</td>
                      <td className="text-right">{o.delays.length || '—'}</td>
                      <td className="text-right">{o.totalDowntimeSecs > 0 ? formatMinutes(Math.round(o.totalDowntimeSecs / 60)) : '—'}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td className="font-bold">Total</td>
                    <td className="text-right font-bold">{totalGuests.toLocaleString()}</td>
                    <td className="text-right font-bold">{totalDispatches}</td>
                    <td className="text-right">—</td>
                    <td className="text-right">—</td>
                    <td className="text-right font-bold">{totalDelays || '—'}</td>
                    <td className="text-right font-bold">{totalDowntimeSecs > 0 ? formatMinutes(Math.round(totalDowntimeSecs / 60)) : '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/* ── Main print view ── */

function PrintContent() {
  const searchParams = useSearchParams();
  const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];

  const [opsData, setOpsData] = useState<AttractionOps[]>([]);
  const [sessions, setSessions] = useState<OperatorSession[]>([]);
  const [dispatches, setDispatches] = useState<DispatchLog[]>([]);
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoPrint, setAutoPrint] = useState(false);

  useEffect(() => {
    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || auth.role !== 'admin') {
        setError('Access denied.');
        setLoading(false);
        return;
      }

      const start = new Date(`${dateStr}T00:00:00`).toISOString();
      const end = new Date(`${dateStr}T23:59:59`).toISOString();

      const [attractionsRes, allLogs, historyRes, throughputRes, dispatchRes, openRes, closeRes, sessionsRes] = await Promise.all([
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
        supabase.from('operator_sessions').select('*').eq('log_date', dateStr).order('started_at', { ascending: true }),
      ]);

      if (attractionsRes.error || historyRes.error || dispatchRes.error) {
        setError('Failed to load operations data.');
        setLoading(false);
        return;
      }

      const ot = openRes.data?.value || '';
      const ct = closeRes.data?.value || '';
      const dp: DispatchLog[] = dispatchRes.data || [];

      setOpsData(buildOpsData(
        attractionsRes.data || [],
        allLogs,
        historyRes.data || [],
        throughputRes.data || [],
        dp,
        ot,
        ct,
        dateStr,
      ));
      setSessions((sessionsRes.data as OperatorSession[]) || []);
      setDispatches(dp);
      setOpenTime(ot);
      setCloseTime(ct);
      setLoading(false);

      if (searchParams.get('print') === '1') {
        setAutoPrint(true);
      }
    }
    init();
  }, [dateStr, searchParams]);

  useEffect(() => {
    if (!loading && !error && autoPrint && opsData.length > 0) {
      setTimeout(() => window.print(), 600);
    }
  }, [loading, error, autoPrint, opsData.length]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#666' }}>
        Loading operations data…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#c0392b' }}>
        {error}
      </div>
    );
  }

  if (opsData.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#666' }}>
        No attractions found for {formatDate(dateStr)}.
      </div>
    );
  }

  return (
    <>
      {/* Screen-only print toolbar */}
      <div className="print-toolbar no-print">
        <div className="toolbar-info">
          <strong>Operations Report</strong>
          {' '}— {opsData.length} attraction{opsData.length !== 1 ? 's' : ''} for {formatDate(dateStr)}
        </div>
        <button className="print-btn" onClick={() => window.print()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Print / Save as PDF
        </button>
      </div>

      {/* Report pages */}
      <div className="print-container">
        <SummaryPage opsData={opsData} dateStr={dateStr} openTime={openTime} closeTime={closeTime} />
        {opsData.map((ops, idx) => (
          <OpsReportPage
            key={ops.attraction.id}
            ops={ops}
            dateStr={dateStr}
            sessions={sessions.filter((s) => s.attraction_id === ops.attraction.id)}
            dispatches={dispatches.filter((d) => d.attraction_id === ops.attraction.id)}
            isLast={idx === opsData.length - 1}
          />
        ))}
      </div>

      <style>{`
        * { box-sizing: border-box; }

        body {
          margin: 0;
          background: #f5f5f5;
          font-family: 'Helvetica Neue', Arial, sans-serif;
          font-size: 11pt;
          color: #111;
          orphans: 3;
          widows: 3;
        }

        /* ── Screen toolbar ── */
        .print-toolbar {
          position: sticky; top: 0; z-index: 100;
          background: #1E1E1E; color: #fff;
          padding: 12px 24px;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          font-family: 'Helvetica Neue', Arial, sans-serif;
        }
        .toolbar-info { font-size: 14px; color: #aaa; }
        .toolbar-info strong { color: #fff; }
        .print-btn {
          display: flex; align-items: center; gap: 8px;
          background: #fff; color: #111; border: none; border-radius: 6px;
          padding: 8px 18px; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: background 0.15s;
        }
        .print-btn:hover { background: #e8e8e8; }

        /* ── Print container ── */
        .print-container { padding: 24px; display: flex; flex-direction: column; gap: 24px; }

        /* ── Report page wrapper (a <table> so thead/tfoot repeat) ── */
        .report-page {
          background: #fff;
          width: 210mm;
          margin: 0 auto;
          box-shadow: 0 2px 12px rgba(0,0,0,0.12);
          border-collapse: collapse;
          table-layout: fixed;
        }

        /* ── Running header (repeats via <thead>) ── */
        .running-header-cell { padding: 10mm 20mm 0; }
        .running-header-inner {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding-bottom: 5px;
        }
        .running-header-name { font-size: 10pt; font-weight: 700; color: #111; }
        .running-header-meta { font-size: 8pt; color: #888; }
        .running-rule { border-top: 1px solid #ccc; margin-top: 4px; }

        /* ── Running footer (repeats via <tfoot>) ── */
        .running-footer-cell { padding: 0 20mm 8mm; }
        .running-footer-inner {
          display: flex;
          justify-content: space-between;
          font-size: 8pt;
          color: #bbb;
          border-top: 1px solid #eee;
          padding-top: 6px;
          margin-top: 6px;
        }

        /* ── Main body cell ── */
        .report-body-cell { padding: 8mm 20mm 6mm; }

        /* ── First-page document header ── */
        .page-header {
          display: flex; align-items: flex-start;
          justify-content: space-between; margin-bottom: 8px;
          page-break-inside: avoid; break-inside: avoid;
        }
        .page-header-left { display: flex; align-items: center; gap: 12px; }
        .header-logo { width: 36px; height: 36px; object-fit: contain; }
        .header-company { font-size: 14pt; font-weight: 700; color: #111; line-height: 1.1; }
        .header-doc-type { font-size: 9pt; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
        .page-header-right { text-align: right; }
        .header-date { font-size: 10pt; font-weight: 600; color: #333; }
        .header-submitted { font-size: 9pt; color: #888; margin-top: 2px; }
        .header-rule { border: none; border-top: 2px solid #111; margin: 8px 0 14px; }

        /* ── Attraction title ── */
        .attraction-title {
          font-size: 22pt; font-weight: 800; color: #111;
          margin: 0 0 16px; letter-spacing: -0.02em;
          page-break-after: avoid; break-after: avoid;
        }

        /* ── Stats row ── */
        .stats-row {
          display: flex; gap: 10px; margin-bottom: 20px;
          page-break-inside: avoid; break-inside: avoid;
        }
        .stat-box {
          flex: 1; border: 1px solid #ddd; border-radius: 6px;
          padding: 10px 8px; text-align: center;
        }
        .stat-label { font-size: 7.5pt; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
        .stat-value { font-size: 13pt; font-weight: 800; color: #111; white-space: nowrap; }

        /* ── Sections ── */
        .section { margin-bottom: 16px; }
        .section-title {
          font-size: 10pt; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.06em; color: #444;
          margin: 0 0 8px; padding-bottom: 4px;
          border-bottom: 1px solid #e8e8e8;
          page-break-after: avoid; break-after: avoid;
        }
        .empty-text { font-size: 10pt; color: #aaa; margin: 0; font-style: italic; }

        /* ── Data tables ── */
        .data-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
        .data-table th {
          text-align: left; font-size: 8.5pt; font-weight: 600; color: #888;
          text-transform: uppercase; letter-spacing: 0.04em;
          padding: 5px 8px; border-bottom: 1px solid #ddd;
        }
        .data-table td {
          padding: 6px 8px; border-bottom: 1px solid #f0f0f0; color: #222;
          page-break-inside: avoid; break-inside: avoid;
        }
        .data-table tr { page-break-inside: avoid; break-inside: avoid; }
        .data-table .total-row td {
          border-top: 1.5px solid #bbb; border-bottom: none; background: #fafafa;
        }
        .text-right { text-align: right !important; }
        .font-bold { font-weight: 700; }

        /* ── Print media ── */
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
            @bottom-right {
              content: "Page " counter(page);
              font-family: 'Helvetica Neue', Arial, sans-serif;
              font-size: 8pt;
              color: #999;
              margin-bottom: 6mm;
              margin-right: 20mm;
            }
          }

          body { background: white; }
          .no-print { display: none !important; }
          .print-container { padding: 0; gap: 0; }

          .report-page {
            box-shadow: none;
            margin: 0;
            width: 100%;
          }

          .running-header-cell { padding-top: 8mm; }
          .report-body-cell { padding-top: 6mm; }
        }
      `}</style>
    </>
  );
}

export default function OperationsPrintPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#666' }}>Loading…</div>}>
      <PrintContent />
    </Suspense>
  );
}
