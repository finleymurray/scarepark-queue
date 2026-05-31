'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getAttractionLogo, getLogoGlow, getGlowRgb } from '@/lib/logos';
import { useConnectionHealth } from '@/hooks/useConnectionHealth';
import { useScreenIdentity } from '@/hooks/useScreenIdentity';
import ParkClosedOverlay from '@/components/ParkClosedOverlay';
import type { Attraction, AttractionStatus, ThroughputLog, AttractionStatusLog } from '@/types/database';

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

function formatTime12h(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const STATUS_COLOR: Record<AttractionStatus, string> = {
  OPEN: '#22C55E',
  CLOSED: '#ef4444',
  DELAYED: '#f0ad4e',
  'AT CAPACITY': '#F59E0B',
};

const STATUS_BG: Record<AttractionStatus, string> = {
  OPEN: 'rgba(34,197,94,0.12)',
  CLOSED: 'rgba(239,68,68,0.12)',
  DELAYED: 'rgba(240,173,78,0.12)',
  'AT CAPACITY': 'rgba(245,158,11,0.12)',
};

/* ── Live delay timer ── */
function DelayTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(() =>
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  );
  useEffect(() => {
    const t = setInterval(() =>
      setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatElapsed(elapsed)}</span>;
}

/* ── Attraction card ── */
function OpsCard({
  attraction,
  guests,
  activeDelay,
  openedAt,
}: {
  attraction: Attraction;
  guests: number;
  activeDelay: AttractionStatusLog | null;
  openedAt: string | null;
}) {
  const status = attraction.status as AttractionStatus;
  const logo = getAttractionLogo(attraction.slug);
  const glow = getLogoGlow(attraction.slug);
  const glowRgb = getGlowRgb(attraction.slug);
  const statusColor = STATUS_COLOR[status] || '#888';
  const statusBg = STATUS_BG[status] || 'rgba(128,128,128,0.1)';

  return (
    <div style={{
      background: '#111',
      border: `1px solid ${status === 'DELAYED' ? 'rgba(240,173,78,0.35)' : status === 'CLOSED' ? 'rgba(239,68,68,0.2)' : '#1e1e1e'}`,
      borderRadius: '1.2vw',
      padding: '1.6vw',
      display: 'flex',
      flexDirection: 'column',
      gap: '1vw',
      position: 'relative',
      overflow: 'hidden',
      transition: 'border-color 0.3s',
    }}>
      {/* Subtle radial glow */}
      {glowRgb && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse at 50% 0%, rgba(${glowRgb},0.07) 0%, transparent 65%)`,
        }} />
      )}

      {/* Logo + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8vw' }}>
        {logo && (
          <img src={logo} alt="" width={36} height={36}
            style={{ width: '2.4vw', height: '2.4vw', objectFit: 'contain', filter: glow || undefined, flexShrink: 0 }} />
        )}
        <span style={{ color: '#fff', fontSize: '1.1vw', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
          {attraction.name}
        </span>
      </div>

      {/* Status pill */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.4vw',
        background: statusBg, border: `1px solid ${statusColor}40`,
        borderRadius: '0.4vw', padding: '0.3vw 0.7vw', alignSelf: 'flex-start',
      }}>
        <div style={{ width: '0.5vw', height: '0.5vw', borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
        <span style={{ color: statusColor, fontSize: '0.8vw', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {status}
        </span>
      </div>

      {/* Queue time — rides only */}
      {attraction.attraction_type === 'ride' && status !== 'CLOSED' && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3vw' }}>
          <span style={{ color: statusColor, fontSize: '3.2vw', fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {attraction.wait_time}
          </span>
          <span style={{ color: '#666', fontSize: '1vw', fontWeight: 600 }}>min</span>
        </div>
      )}

      {/* Delay timer */}
      {status === 'DELAYED' && activeDelay && (
        <div style={{
          background: 'rgba(240,173,78,0.1)', border: '1px solid rgba(240,173,78,0.25)',
          borderRadius: '0.5vw', padding: '0.4vw 0.7vw',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5vw',
        }}>
          <div>
            <div style={{ color: '#f0ad4e', fontSize: '0.7vw', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.1vw' }}>
              Down for
            </div>
            <div style={{ color: '#f0ad4e', fontSize: '1.4vw', fontWeight: 800 }}>
              <DelayTimer startedAt={activeDelay.changed_at} />
            </div>
          </div>
          {activeDelay.reason && (
            <div style={{
              background: 'rgba(240,173,78,0.15)', borderRadius: '0.3vw',
              padding: '0.2vw 0.5vw', fontSize: '0.7vw', fontWeight: 600, color: '#f0ad4e',
            }}>
              {activeDelay.reason}
            </div>
          )}
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '1vw', marginTop: 'auto' }}>
        {guests > 0 && (
          <div>
            <div style={{ color: '#555', fontSize: '0.65vw', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.1vw' }}>Guests tonight</div>
            <div style={{ color: '#ccc', fontSize: '1vw', fontWeight: 700 }}>{guests.toLocaleString()}</div>
          </div>
        )}
        {openedAt && (
          <div>
            <div style={{ color: '#555', fontSize: '0.65vw', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.1vw' }}>Opened</div>
            <div style={{ color: '#ccc', fontSize: '1vw', fontWeight: 700 }}>{formatTime12h(openedAt.slice(11, 16))}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function TvOpsPage() {
  useConnectionHealth('tv-ops');
  useScreenIdentity('/tv-ops');

  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [throughput, setThroughput] = useState<ThroughputLog[]>([]);
  const [statusLogs, setStatusLogs] = useState<AttractionStatusLog[]>([]);
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

      const [attractionsRes, tpRes, logsRes, closeRes] = await Promise.all([
        supabase.from('attractions').select('*').order('sort_order', { ascending: true }),
        supabase.from('throughput_logs').select('*').eq('log_date', today),
        supabase.from('attraction_status_logs').select('*').gte('changed_at', start).lte('changed_at', end).order('changed_at', { ascending: true }),
        supabase.from('park_settings').select('value').eq('key', 'closing_time').single(),
      ]);

      setAttractions((attractionsRes.data || []).filter((a: Attraction) => a.attraction_type === 'ride'));
      setThroughput(tpRes.data || []);
      setStatusLogs(logsRes.data || []);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attraction_status_logs' }, async () => {
        const start = `${today}T00:00:00`;
        const end   = `${today}T23:59:59`;
        const { data } = await supabase.from('attraction_status_logs').select('*').gte('changed_at', start).lte('changed_at', end).order('changed_at', { ascending: true });
        setStatusLogs(data || []);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Derive per-attraction data
  const attractionData = attractions.map((a) => {
    const aLogs = statusLogs.filter((l) => l.attraction_id === a.id);
    const guests = throughput.filter((t) => t.attraction_id === a.id).reduce((s, t) => s + (t.guest_count || 0), 0);
    const firstOpen = aLogs.find((l) => l.status === 'OPEN');
    const activeDelay = aLogs.find((l) => l.status === 'DELAYED' && !l.resolved_at) || null;
    return { attraction: a, guests, activeDelay, openedAt: firstOpen?.changed_at || null };
  });

  const totalGuests = attractionData.reduce((s, d) => s + d.guests, 0);
  const delayedCount = attractions.filter((a) => a.status === 'DELAYED').length;
  const closedCount = attractions.filter((a) => a.status === 'CLOSED').length;

  // Clock string
  const timeStr = now.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a', color: '#fff',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: '1.5vw',
      gap: '1.2vw',
    }}>
      <ParkClosedOverlay />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1vw' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-admin.png" alt="" style={{ width: '2.2vw', height: '2.2vw', objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: '1.3vw', fontWeight: 700, color: '#fff', lineHeight: 1 }}>Operations View</div>
            <div style={{ fontSize: '0.75vw', color: '#555', marginTop: '0.2vw' }}>Live</div>
          </div>
        </div>

        {/* Summary pills */}
        <div style={{ display: 'flex', gap: '0.8vw', alignItems: 'center' }}>
          {delayedCount > 0 && (
            <div style={{ background: 'rgba(240,173,78,0.12)', border: '1px solid rgba(240,173,78,0.3)', borderRadius: '0.5vw', padding: '0.4vw 0.9vw', fontSize: '0.85vw', color: '#f0ad4e', fontWeight: 700 }}>
              {delayedCount} delayed
            </div>
          )}
          {closedCount > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '0.5vw', padding: '0.4vw 0.9vw', fontSize: '0.85vw', color: '#ef4444', fontWeight: 700 }}>
              {closedCount} closed
            </div>
          )}
          {totalGuests > 0 && (
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: '0.5vw', padding: '0.4vw 0.9vw', fontSize: '0.85vw', color: '#ccc', fontWeight: 700 }}>
              {totalGuests.toLocaleString()} guests tonight
            </div>
          )}
          {closingTime && (
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: '0.5vw', padding: '0.4vw 0.9vw', fontSize: '0.85vw', color: '#666', fontWeight: 600 }}>
              Closes {formatTime12h(closingTime)}
            </div>
          )}
          <div style={{ fontSize: '1vw', fontWeight: 700, color: '#fff', textAlign: 'right', marginLeft: '0.5vw' }}>
            <div>{timeStr.toUpperCase()}</div>
            <div style={{ fontSize: '0.65vw', color: '#555', fontWeight: 500, marginTop: '0.1vw' }}>{dateStr}</div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#1a1a1a' }} />

      {/* Attraction grid */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(attractions.length, 3)}, 1fr)`,
        gap: '1.2vw',
        alignContent: 'start',
      }}>
        {attractionData.map(({ attraction, guests, activeDelay, openedAt }) => (
          <OpsCard
            key={attraction.id}
            attraction={attraction}
            guests={guests}
            activeDelay={activeDelay}
            openedAt={openedAt}
          />
        ))}
      </div>
    </div>
  );
}
