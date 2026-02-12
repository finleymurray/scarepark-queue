'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { ParkSetting } from '@/types/database';

function formatTime12h(time: string): string {
  if (!time) return '--:--';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${m} ${ampm}`;
}

/**
 * TV4 — Carousel that cycles through all TV views via iframes.
 *
 * Sequence:
 *   /tv2  (ride banners, paginated)  — 30s  (tv2 handles its own 10s page cycling)
 *   /tv3  (show times grid)          — 15s
 *   /tv1  (queue + show times list)  — 15s
 *
 * Each iframe stays mounted so realtime subscriptions stay alive.
 * Only the active iframe is visible; transitions use a fade effect.
 *
 * TV4 renders its own persistent header + footer so they never jump
 * between page transitions. The embedded TV1/TV2/TV3 iframes hide
 * their own headers and footers via isEmbedded detection.
 */

const VIEWS = [
  { path: '/tv2', duration: 30000 },
  { path: '/tv3', duration: 15000 },
  { path: '/tv1', duration: 15000 },
];

const FADE_MS = 600;
const TV_SAFE_PADDING = '3.5%';

/* ── Styles matching TV1/TV2/TV3 exactly ── */

const headerStyle: React.CSSProperties = {
  background:
    'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.04) 0%, transparent 70%), linear-gradient(180deg, rgba(30,30,30,0.95) 0%, rgba(15,15,15,0.95) 100%)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  padding: '18px 40px',
  textAlign: 'center' as const,
  marginBottom: 12,
  flexShrink: 0,
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(255,255,255,0.02), 0 0 15px rgba(255,255,255,0.03), 0 0 30px rgba(255,255,255,0.015), 0 4px 12px rgba(0,0,0,0.4)',
};

const headerTitleStyle: React.CSSProperties = {
  fontSize: '2.2vw',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.2em',
  color: '#fff',
  textShadow: '0 0 10px rgba(255,255,255,0.15), 0 0 25px rgba(255,255,255,0.08)',
  margin: 0,
};

const footerStyle: React.CSSProperties = {
  background:
    'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.04) 0%, transparent 70%), linear-gradient(180deg, rgba(30,30,30,0.95) 0%, rgba(15,15,15,0.95) 100%)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  padding: '14px 40px',
  marginTop: 12,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(255,255,255,0.02), 0 0 15px rgba(255,255,255,0.03), 0 0 30px rgba(255,255,255,0.015), 0 4px 12px rgba(0,0,0,0.4)',
};

export default function TV4Carousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [closingTime, setClosingTime] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeRefsMap = useRef<Map<number, HTMLIFrameElement>>(new Map());
  const animFrameRef = useRef<number>(0);

  /* Fetch closing time + subscribe to changes */
  useEffect(() => {
    async function fetchClosingTime() {
      const { data } = await supabase
        .from('park_settings')
        .select('key,value')
        .eq('key', 'closing_time')
        .single();
      if (data) setClosingTime(data.value);
    }

    fetchClosingTime();

    const channel = supabase
      .channel('tv4-settings')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'park_settings' },
        (payload) => {
          const setting = payload.new as ParkSetting;
          if (setting.key === 'closing_time') {
            setClosingTime(setting.value);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* Carousel timer — JS-driven fade animation */
  useEffect(() => {
    function scheduleNext() {
      const current = VIEWS[activeIndex];
      timerRef.current = setTimeout(() => {
        setActiveIndex((prev) => {
          const oldIdx = prev;
          const newIdx = (prev + 1) % VIEWS.length;

          const oldEl = iframeRefsMap.current.get(oldIdx);
          const newEl = iframeRefsMap.current.get(newIdx);
          if (oldEl) oldEl.style.opacity = '1';
          if (newEl) { newEl.style.opacity = '0'; newEl.style.pointerEvents = 'auto'; }

          const startTime = performance.now();
          function animate(now: number) {
            const progress = Math.min((now - startTime) / FADE_MS, 1);
            if (oldEl) oldEl.style.opacity = String(1 - progress);
            if (newEl) newEl.style.opacity = String(progress);
            if (progress < 1) {
              animFrameRef.current = requestAnimationFrame(animate);
            } else {
              if (oldEl) { oldEl.style.opacity = '0'; oldEl.style.pointerEvents = 'none'; }
              if (newEl) { newEl.style.opacity = '1'; newEl.style.pointerEvents = 'auto'; }
            }
          }
          animFrameRef.current = requestAnimationFrame(animate);

          return newIdx;
        });
      }, current.duration);
    }

    scheduleNext();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [activeIndex]);

  return (
    <div
      className="h-screen w-screen bg-black flex flex-col overflow-hidden"
      style={{
        paddingLeft: TV_SAFE_PADDING,
        paddingRight: TV_SAFE_PADDING,
        paddingTop: '2%',
        paddingBottom: '2%',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: '#fff',
      }}
    >
      {/* Header */}
      <div style={headerStyle}>
        <h1 style={headerTitleStyle}>Live Times</h1>
      </div>

      {/* Iframe carousel */}
      <div className="flex-1 relative overflow-hidden">
        {VIEWS.map((view, i) => (
          <iframe
            key={view.path}
            ref={(el) => {
              if (el) iframeRefsMap.current.set(i, el);
              else iframeRefsMap.current.delete(i);
            }}
            src={view.path}
            title={`TV View ${view.path}`}
            className="absolute inset-0 w-full h-full border-0"
            style={{
              opacity: i === activeIndex ? 1 : 0,
              pointerEvents: i === activeIndex ? 'auto' : 'none',
            }}
          />
        ))}
      </div>

      {/* Footer */}
      <footer style={footerStyle}>
        <span
          style={{
            fontSize: '1.4vw',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: 'rgba(255,255,255,0.45)',
          }}
        >
          Park Closes
        </span>
        <span
          style={{
            fontSize: '1.8vw',
            fontWeight: 900,
            fontVariantNumeric: 'tabular-nums',
            color: '#fff',
            textShadow: '0 0 10px rgba(255,255,255,0.2), 0 0 25px rgba(255,255,255,0.08)',
          }}
        >
          {formatTime12h(closingTime)}
        </span>
      </footer>
    </div>
  );
}
