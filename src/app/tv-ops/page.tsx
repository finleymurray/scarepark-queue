'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getAttractionLogo, getLogoGlow, getGlowRgb } from '@/lib/logos';
import { useConnectionHealth } from '@/hooks/useConnectionHealth';
import { useScreenIdentity } from '@/hooks/useScreenIdentity';
import { surface, border, text, statusColors, microLabel, FONT_NUM } from '@/lib/theme';
import type {
  Attraction,
  AttractionStatus,
  ThroughputLog,
  DispatchLog,
  AttractionStatusLog,
  OperatorSession,
  SignoffSection,
  SignoffCompletion,
} from '@/types/database';

/* ── Helpers ── */

function getTodayDateStr() {
  return new Date().toISOString().split('T')[0];
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Format a HH:MM string (e.g. from park_settings) as 12h local time */
function formatHHMM(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type SignoffState = 'complete' | 'incomplete' | 'none';

/* ── Live counter (1s tick) — reused for active delay + live total downtime ── */
function LiveElapsed({ baseSeconds, sinceMs }: { baseSeconds: number; sinceMs: number | null }) {
  const compute = () =>
    baseSeconds + (sinceMs ? Math.max(0, Math.floor((Date.now() - sinceMs) / 1000)) : 0);
  const [elapsed, setElapsed] = useState(compute);
  useEffect(() => {
    if (sinceMs == null) {
      setElapsed(compute);
      return;
    }
    setElapsed(compute());
    const t = setInterval(() => setElapsed(compute()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseSeconds, sinceMs]);
  return <span style={FONT_NUM}>{formatElapsed(elapsed)}</span>;
}

/* ── Per-attraction derived shape ── */
interface CardData {
  attraction: Attraction;
  guests: number;
  activeDelay: AttractionStatusLog | null;
  /** resolved downtime seconds tonight (excludes the live portion) */
  resolvedDowntimeSec: number;
  /** ms timestamp the active delay began, or null if none active */
  activeDelaySinceMs: number | null;
  operator: OperatorSession | null;
  opening: SignoffState;
  closing: SignoffState;
}

/* ── Sign-off pill ── */
function SignoffStat({ label, state }: { label: string; state: SignoffState }) {
  const color =
    state === 'complete' ? statusColors('OPEN').text
    : state === 'incomplete' ? statusColors('CLOSED').text
    : text.faint;
  const mark = state === 'complete' ? '✓' : state === 'incomplete' ? '✗' : '—';
  return (
    <div>
      <div style={microLabel}>{label}</div>
      <div style={{ ...FONT_NUM, color, fontSize: '0.95vw', fontWeight: 800, lineHeight: 1.1 }}>
        {mark}
      </div>
    </div>
  );
}

/* ── Attraction card ── */
function OpsCard({ data }: { data: CardData }) {
  const {
    attraction, guests, activeDelay, resolvedDowntimeSec, activeDelaySinceMs, operator, opening, closing,
  } = data;
  const status = attraction.status as AttractionStatus;
  const logo = getAttractionLogo(attraction.slug);
  const glow = getLogoGlow(attraction.slug);
  const glowRgb = getGlowRgb(attraction.slug);
  const sc = statusColors(status);
  const hasDowntime = resolvedDowntimeSec > 0 || activeDelaySinceMs != null;

  return (
    <div style={{
      background: surface.card,
      border: `1px solid ${border.default}`,
      borderLeft: `3px solid ${sc.rail}`,
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
      borderRadius: 12,
      padding: '1.1vw 1.2vw',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.7vw',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle radial glow */}
      {glowRgb && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse at 50% 0%, rgba(${glowRgb},0.06) 0%, transparent 65%)`,
        }} />
      )}

      {/* 1 ── Header: logo + name (left), status pill (right) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7vw', zIndex: 1 }}>
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" width={32} height={32}
            style={{ width: '2.1vw', height: '2.1vw', objectFit: 'contain', filter: glow || undefined, flexShrink: 0 }} />
        )}
        <span style={{ color: text.primary, fontSize: '1.05vw', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.01em', flex: 1 }}>
          {attraction.name}
        </span>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.35vw',
          background: sc.soft, border: `1px solid ${sc.rail}40`,
          borderRadius: 999, padding: '0.25vw 0.7vw', flexShrink: 0,
        }}>
          <div style={{ width: '0.45vw', height: '0.45vw', borderRadius: '50%', background: sc.rail, flexShrink: 0 }} />
          <span style={{ color: sc.text, fontSize: '0.72vw', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {status}
          </span>
        </div>
      </div>

      {/* 2 ── Operator row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5vw', zIndex: 1 }}>
        {operator ? (
          <>
            <div style={{
              width: '1.7vw', height: '1.7vw', borderRadius: '50%', flexShrink: 0,
              background: surface.raised, border: `1px solid ${border.strong}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: text.primary, fontSize: '0.65vw', fontWeight: 800, letterSpacing: '0.02em',
            }}>
              {initials(operator.operator_name)}
            </div>
            <span style={{ color: text.secondary, fontSize: '0.85vw', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {operator.operator_name}
            </span>
          </>
        ) : (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4vw',
            border: `1px dashed ${border.strong}`, borderRadius: 999,
            padding: '0.2vw 0.7vw', color: text.muted, fontSize: '0.78vw', fontWeight: 600,
          }}>
            No operator
          </div>
        )}
      </div>

      {/* 3 ── Focal region */}
      {status === 'DELAYED' && activeDelay ? (
        <div style={{
          background: statusColors('DELAYED').soft,
          border: `1px solid ${statusColors('DELAYED').rail}40`,
          borderRadius: 10, padding: '0.7vw 0.8vw', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.5vw' }}>
            <div>
              <div style={{ ...microLabel, color: statusColors('DELAYED').text }}>Down for</div>
              <div style={{ ...FONT_NUM, color: statusColors('DELAYED').text, fontSize: '2.1vw', fontWeight: 900, lineHeight: 1 }}>
                <LiveElapsed baseSeconds={0} sinceMs={new Date(activeDelay.changed_at).getTime()} />
              </div>
            </div>
            {activeDelay.reason && (
              <div style={{
                background: statusColors('DELAYED').rail, borderRadius: 6,
                padding: '0.25vw 0.6vw', fontSize: '0.8vw', fontWeight: 800, color: '#1a1206', flexShrink: 0,
              }}>
                {activeDelay.reason}
              </div>
            )}
          </div>
          {activeDelay.notes && (
            <div style={{ color: statusColors('DELAYED').text, opacity: 0.85, fontSize: '0.75vw', fontWeight: 500, marginTop: '0.4vw', lineHeight: 1.25 }}>
              {activeDelay.notes}
            </div>
          )}
        </div>
      ) : attraction.attraction_type === 'ride' && status !== 'CLOSED' ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3vw', zIndex: 1 }}>
          <span style={{ ...FONT_NUM, color: sc.text, fontSize: '3vw', fontWeight: 900, lineHeight: 1 }}>
            {attraction.wait_time}
          </span>
          <span style={{ color: text.muted, fontSize: '0.95vw', fontWeight: 600 }}>min</span>
        </div>
      ) : (
        <div style={{ color: sc.text, fontSize: '1.6vw', fontWeight: 800, zIndex: 1 }}>
          {status}
        </div>
      )}

      {/* 4 ── Stat strip (2×2 mini-grid) */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5vw 0.9vw',
        marginTop: 'auto', paddingTop: '0.6vw', borderTop: `1px solid ${border.divider}`, zIndex: 1,
      }}>
        <div>
          <div style={microLabel}>Guests</div>
          <div style={{ ...FONT_NUM, color: text.primary, fontSize: '0.95vw', fontWeight: 800, lineHeight: 1.1 }}>
            {guests.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={microLabel}>Downtime</div>
          <div style={{
            ...FONT_NUM, fontSize: '0.95vw', fontWeight: 800, lineHeight: 1.1,
            color: hasDowntime ? statusColors('DELAYED').text : text.faint,
          }}>
            {hasDowntime
              ? <LiveElapsed baseSeconds={resolvedDowntimeSec} sinceMs={activeDelaySinceMs} />
              : '0:00'}
          </div>
        </div>
        <SignoffStat label="Opening" state={opening} />
        <SignoffStat label="Closing" state={closing} />
      </div>
    </div>
  );
}

/* ── Header summary pill ── */
function SummaryPill({ value, label, color, soft, bordered }: {
  value: string; label: string; color: string; soft: string; bordered: string;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
      background: soft, border: `1px solid ${bordered}`, borderRadius: 10,
      padding: '0.4vw 0.9vw', minWidth: '4.5vw',
    }}>
      <span style={{ ...FONT_NUM, color, fontSize: '1.3vw', fontWeight: 900, lineHeight: 1 }}>{value}</span>
      <span style={{ ...microLabel, fontSize: '0.6vw', marginTop: '0.15vw' }}>{label}</span>
    </div>
  );
}

/* ── Main page ── */
export default function TvOpsPage() {
  useConnectionHealth('tv-ops');
  useScreenIdentity('/tv-ops');

  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [throughput, setThroughput] = useState<ThroughputLog[]>([]);
  const [dispatches, setDispatches] = useState<DispatchLog[]>([]);
  const [statusLogs, setStatusLogs] = useState<AttractionStatusLog[]>([]);
  const [operators, setOperators] = useState<OperatorSession[]>([]);
  const [sections, setSections] = useState<SignoffSection[]>([]);
  const [completions, setCompletions] = useState<SignoffCompletion[]>([]);
  const [closingTime, setClosingTime] = useState('');
  const [now, setNow] = useState(new Date());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clock tick
  useEffect(() => {
    tickRef.current = setInterval(() => setNow(new Date()), 30_000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  // Initial fetch
  useEffect(() => {
    async function init() {
      const today = getTodayDateStr();
      const start = `${today}T00:00:00`;
      const end   = `${today}T23:59:59`;

      const [attractionsRes, tpRes, dispRes, logsRes, opsRes, secRes, compRes, closeRes] = await Promise.all([
        supabase.from('attractions').select('*').order('sort_order', { ascending: true }),
        supabase.from('throughput_logs').select('*').eq('log_date', today),
        supabase.from('dispatch_logs').select('*').eq('log_date', today),
        supabase.from('attraction_status_logs').select('*').gte('changed_at', start).lte('changed_at', end).order('changed_at', { ascending: true }),
        supabase.from('operator_sessions').select('*').eq('log_date', today).order('started_at', { ascending: true }),
        supabase.from('signoff_sections').select('*'),
        supabase.from('signoff_completions').select('*').eq('sign_date', today),
        supabase.from('park_settings').select('value').eq('key', 'closing_time').single(),
      ]);

      setAttractions((attractionsRes.data || []).filter((a: Attraction) => a.attraction_type === 'ride'));
      setThroughput(tpRes.data || []);
      setDispatches(dispRes.data || []);
      setStatusLogs(logsRes.data || []);
      setOperators(opsRes.data || []);
      setSections(secRes.data || []);
      setCompletions(compRes.data || []);
      setClosingTime(closeRes.data?.value || '');
    }
    init();
  }, []);

  // Realtime
  useEffect(() => {
    const today = getTodayDateStr();
    const channel = supabase.channel('tv-ops-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attractions' }, (payload) => {
        setAttractions((prev) => prev.map((a) => a.id === (payload.new as Attraction).id ? (payload.new as Attraction) : a));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'throughput_logs' }, async () => {
        const { data } = await supabase.from('throughput_logs').select('*').eq('log_date', today);
        setThroughput(data || []);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_logs' }, async () => {
        const { data } = await supabase.from('dispatch_logs').select('*').eq('log_date', today);
        setDispatches(data || []);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attraction_status_logs' }, async () => {
        const start = `${today}T00:00:00`;
        const end   = `${today}T23:59:59`;
        const { data } = await supabase.from('attraction_status_logs').select('*').gte('changed_at', start).lte('changed_at', end).order('changed_at', { ascending: true });
        setStatusLogs(data || []);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'operator_sessions' }, async () => {
        const { data } = await supabase.from('operator_sessions').select('*').eq('log_date', today).order('started_at', { ascending: true });
        setOperators(data || []);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'signoff_completions' }, async () => {
        const { data } = await supabase.from('signoff_completions').select('*').eq('sign_date', today);
        setCompletions(data || []);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'signoff_sections' }, async () => {
        const { data } = await supabase.from('signoff_sections').select('*');
        setSections(data || []);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Derive per-attraction data
  const nowMs = now.getTime();
  const attractionData: CardData[] = attractions.map((a) => {
    const aLogs = statusLogs.filter((l) => l.attraction_id === a.id);
    // Guests come from the dispatch clicker (matches Control's figure), not
    // the manual throughput_logs which are only occasional hourly overrides.
    const guests = dispatches.filter((d) => d.attraction_id === a.id).reduce((s, d) => s + (d.group_size || 0), 0);
    const activeDelay = aLogs.find((l) => l.status === 'DELAYED' && !l.resolved_at) || null;

    // Downtime: sum over DELAYED logs of (resolved_at ?? now) − changed_at.
    // Resolved portion is fixed; the active delay's live portion is rendered by LiveElapsed.
    let resolvedDowntimeSec = 0;
    for (const l of aLogs) {
      if (l.status !== 'DELAYED') continue;
      if (l.resolved_at) {
        resolvedDowntimeSec += Math.max(0, Math.floor((new Date(l.resolved_at).getTime() - new Date(l.changed_at).getTime()) / 1000));
      }
    }
    const activeDelaySinceMs = activeDelay ? new Date(activeDelay.changed_at).getTime() : null;

    // Active operator: latest started_at among un-ended sessions
    const activeOps = operators
      .filter((o) => o.attraction_id === a.id && o.ended_at == null)
      .sort((x, y) => new Date(y.started_at).getTime() - new Date(x.started_at).getTime());
    const operator = activeOps[0] || null;

    // Sign-off: complete when every section in a phase has a matching completion today.
    const phaseState = (phase: 'opening' | 'closing'): SignoffState => {
      const phaseSections = sections.filter((s) => s.attraction_id === a.id && s.phase === phase);
      if (phaseSections.length === 0) return 'none';
      const done = phaseSections.every((s) =>
        completions.some((c) => c.attraction_id === a.id && c.section_id === s.id));
      return done ? 'complete' : 'incomplete';
    };

    return {
      attraction: a, guests, activeDelay, resolvedDowntimeSec, activeDelaySinceMs, operator,
      opening: phaseState('opening'), closing: phaseState('closing'),
    };
  });

  const totalGuests = attractionData.reduce((s, d) => s + d.guests, 0);
  const openCount = attractions.filter((a) => a.status === 'OPEN').length;
  const delayedCount = attractions.filter((a) => a.status === 'DELAYED').length;
  const closedCount = attractions.filter((a) => a.status === 'CLOSED').length;

  // Total park downtime: resolved seconds + live active portion across all attractions.
  const totalResolvedDowntime = attractionData.reduce((s, d) => s + d.resolvedDowntimeSec, 0);
  const totalActiveDowntime = attractionData.reduce(
    (s, d) => s + (d.activeDelaySinceMs ? Math.max(0, Math.floor((nowMs - d.activeDelaySinceMs) / 1000)) : 0), 0);
  const totalDowntime = totalResolvedDowntime + totalActiveDowntime;
  const anyLiveDelay = attractionData.some((d) => d.activeDelaySinceMs != null);

  const timeStr = now.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const amber = statusColors('DELAYED');

  return (
    <div style={{
      height: '100vh', background: surface.page, color: text.primary,
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: '1.4vw', gap: '1.1vw', overflow: 'hidden', boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1vw' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9vw' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-admin.png" alt="" style={{ width: '2.2vw', height: '2.2vw', objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: '1.3vw', fontWeight: 700, color: text.primary, lineHeight: 1 }}>Operations View</div>
            <div style={{ fontSize: '0.72vw', color: text.muted, marginTop: '0.2vw' }}>Live command board</div>
          </div>
        </div>

        {/* Summary pills */}
        <div style={{ display: 'flex', gap: '0.7vw', alignItems: 'center' }}>
          <SummaryPill value={String(openCount)} label="Open" color={statusColors('OPEN').text} soft={statusColors('OPEN').soft} bordered={`${statusColors('OPEN').rail}40`} />
          <SummaryPill value={String(delayedCount)} label="Delayed" color={amber.text} soft={amber.soft} bordered={`${amber.rail}40`} />
          <SummaryPill value={String(closedCount)} label="Closed" color={statusColors('CLOSED').text} soft={statusColors('CLOSED').soft} bordered={`${statusColors('CLOSED').rail}40`} />
          <SummaryPill value={totalGuests.toLocaleString()} label="Guests" color={text.primary} soft={surface.card} bordered={border.default} />
          {/* Total park downtime — live */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
            background: totalDowntime > 0 ? amber.soft : surface.card,
            border: `1px solid ${totalDowntime > 0 ? `${amber.rail}40` : border.default}`,
            borderRadius: 10, padding: '0.4vw 0.9vw', minWidth: '5.5vw',
          }}>
            <span style={{ ...FONT_NUM, color: totalDowntime > 0 ? amber.text : text.faint, fontSize: '1.3vw', fontWeight: 900, lineHeight: 1 }}>
              {anyLiveDelay
                ? <LiveElapsed baseSeconds={totalResolvedDowntime} sinceMs={nowMs - totalActiveDowntime * 1000} />
                : formatElapsed(totalDowntime)}
            </span>
            <span style={{ ...microLabel, fontSize: '0.6vw', marginTop: '0.15vw' }}>Park downtime</span>
          </div>
          {closingTime && (
            <div style={{ background: surface.card, border: `1px solid ${border.default}`, borderRadius: 10, padding: '0.4vw 0.9vw', fontSize: '0.8vw', color: text.muted, fontWeight: 600 }}>
              Closes {formatHHMM(closingTime)}
            </div>
          )}
          <div style={{ textAlign: 'right', marginLeft: '0.3vw' }}>
            <div style={{ ...FONT_NUM, fontSize: '1.2vw', fontWeight: 800, color: text.primary, lineHeight: 1 }}>{timeStr.toUpperCase()}</div>
            <div style={{ fontSize: '0.62vw', color: text.muted, fontWeight: 500, marginTop: '0.15vw' }}>{dateStr}</div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: border.divider }} />

      {/* Attraction grid — 3 columns, fills remaining height with no scroll */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(Math.max(attractions.length, 1), 3)}, 1fr)`,
        gridAutoRows: '1fr',
        gap: '1vw',
      }}>
        {attractionData.map((data) => (
          <OpsCard key={data.attraction.id} data={data} />
        ))}
      </div>
    </div>
  );
}
