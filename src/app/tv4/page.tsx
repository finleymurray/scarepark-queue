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
 *   /tv2.5  (ride banners, scrolling ticker)  — 30s
 *   /tv3    (show times grid)                 — 15s
 *   /tv1    (queue + show times list)         — 15s
 *
 * Each iframe stays mounted so realtime subscriptions stay alive.
 * Only the active iframe is visible; transitions use a fade effect.
 *
 * TV4 renders its own persistent header + footer so they never jump
 * between page transitions. The embedded TV1/TV2/TV3 iframes hide
 * their own headers and footers via isEmbedded detection.
 */

const VIEWS = [
  { path: '/tv2.5', duration: 30000 },
  { path: '/tv3', duration: 15000 },
  { path: '/tv1', duration: 15000 },
];

const TV_SAFE_PADDING = '3.5%';

/* ── Clean header/footer — borderline style, no rounded containers ── */

const headerStyle: React.CSSProperties = {
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  padding: '1.5vw 0',
  textAlign: 'center' as const,
  marginBottom: '0.8vw',
  flexShrink: 0,
};

const headerTitleStyle: React.CSSProperties = {
  fontSize: '1.8vw',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.35em',
  color: '#fff',
  margin: 0,
};

const footerStyle: React.CSSProperties = {
  borderTop: '1px solid rgba(255,255,255,0.1)',
  padding: '1.2vw 0',
  marginTop: '0.8vw',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'center',
  gap: '1vw',
};

export default function TV4Carousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [closingTime, setClosingTime] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /* Carousel timer — instant swap (fading iframes is too heavy for TV hardware) */
  useEffect(() => {
    const current = VIEWS[activeIndex];
    timerRef.current = setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % VIEWS.length);
    }, current.duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
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

      {/* Iframe carousel — instant swap, no fade (too heavy for TV hardware) */}
      <div className="flex-1 relative overflow-hidden">
        {VIEWS.map((view, i) => (
          <iframe
            key={view.path}
            src={view.path}
            title={`TV View ${view.path}`}
            className="absolute inset-0 w-full h-full border-0"
            style={{
              visibility: i === activeIndex ? 'visible' : 'hidden',
              pointerEvents: i === activeIndex ? 'auto' : 'none',
            }}
          />
        ))}
      </div>

      {/* Footer */}
      <footer style={footerStyle}>
        <span
          style={{
            fontSize: '1vw',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            color: 'rgba(255,255,255,0.35)',
          }}
        >
          Park Closes
        </span>
        <span
          style={{
            fontSize: '2.2vw',
            fontWeight: 900,
            fontVariantNumeric: 'tabular-nums',
            color: '#fff',
          }}
        >
          {formatTime12h(closingTime)}
        </span>
      </footer>
    </div>
  );
}
