'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import LightningBorder from '@/components/LightningBorder';
import ElectricHeader from '@/components/ElectricHeader';
import type { ParkSetting } from '@/types/database';
import { useConnectionHealth } from '@/hooks/useConnectionHealth';
import { useScreenAssignment } from '@/hooks/useScreenAssignment';

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
 *   /tv2    (ride banners, scrolling ticker)  — 30s
 *   /tv3    (show times grid)                 — 15s
 *   /tv1    (queue + show times list)         — 15s
 *
 * Each iframe stays mounted so realtime subscriptions stay alive.
 * Only the active iframe is visible; transitions use a fade effect.
 *
 * TV4 renders its own persistent header + footer so they never jump
 * between page transitions. The embedded iframes hide
 * their own headers and footers via isEmbedded detection.
 */

const VIEWS = [
  { path: '/tv2', duration: 30000, title: 'Maze Queue Times', fullscreen: false },
  { path: '/tv3', duration: 15000, title: 'Show Schedule', fullscreen: false },
  { path: '/tv1', duration: 15000, title: 'Mazes & Shows', fullscreen: false },
  { path: '/tv5', duration: 8500, title: '', fullscreen: true },
];

const TV_SAFE_PADDING = '3.5%';

/* ── Clean header/footer — borderline style, no rounded containers ── */

const headerStyle: React.CSSProperties = {
  padding: '1.5vw 0 0',
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
  marginTop: '0.8vw',
  flexShrink: 0,
};

const footerInnerStyle: React.CSSProperties = {
  padding: '1.2vw 0',
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'center',
  gap: '1vw',
};

export default function TV4Carousel() {
  useConnectionHealth('tv4');
  useScreenAssignment();
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

  /* When active view changes, tell the newly-visible iframe to reset scroll */
  const iframeRefs = useRef<(HTMLIFrameElement | null)[]>([]);

  useEffect(() => {
    const iframe = iframeRefs.current[activeIndex];
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'tv4-reset-scroll' }, '*');
    }
    // Tell TV5 to restart its sequence when it becomes visible
    if (VIEWS[activeIndex].path === '/tv5') {
      const tv5Iframe = iframeRefs.current[VIEWS.findIndex(v => v.path === '/tv5')];
      if (tv5Iframe?.contentWindow) {
        tv5Iframe.contentWindow.postMessage({ type: 'tv5-restart' }, '*');
      }
    }
  }, [activeIndex]);

  /* Carousel timer — advances to next view after duration elapses */
  useEffect(() => {
    const current = VIEWS[activeIndex];
    timerRef.current = setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % VIEWS.length);
    }, current.duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeIndex]);

  const isFullscreen = VIEWS[activeIndex].fullscreen;

  return (
    <div
      className="h-screen w-screen bg-black flex flex-col overflow-hidden"
      style={{
        paddingLeft: isFullscreen ? 0 : TV_SAFE_PADDING,
        paddingRight: isFullscreen ? 0 : TV_SAFE_PADDING,
        paddingTop: isFullscreen ? 0 : '2%',
        paddingBottom: isFullscreen ? 0 : '2%',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: '#fff',
      }}
    >
      {/* Header — hidden during fullscreen views (e.g. TV5 glitch montage) */}
      {!isFullscreen && (
        <div style={{ flexShrink: 0 }}>
          <ElectricHeader title={VIEWS[activeIndex].title} fontSize="3vw" />
          <LightningBorder />
        </div>
      )}

      {/* Iframe carousel — GPU-composited opacity crossfade */}
      <div className="flex-1 relative overflow-hidden">
        {VIEWS.map((view, i) => (
          <iframe
            key={view.path}
            ref={(el) => { iframeRefs.current[i] = el; }}
            src={view.path}
            title={`TV View ${view.path}`}
            className="absolute inset-0 w-full h-full border-0"
            style={{
              opacity: i === activeIndex ? 1 : 0,
              transition: view.fullscreen || isFullscreen ? 'none' : 'opacity 0.5s ease-in-out',
              pointerEvents: i === activeIndex ? 'auto' : 'none',
            }}
          />
        ))}
      </div>

      {/* Footer — hidden during fullscreen views */}
      {!isFullscreen && (
        <footer style={{ flexShrink: 0 }}>
          <LightningBorder />
          <div style={{ textAlign: 'center', padding: '0.3vw 0' }}>
            <span style={{ fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif", fontSize: '1vw', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)' }}>
              Park Closes{' '}
            </span>
            <span style={{ fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif", fontSize: '1.7vw', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.7)' }}>
              {formatTime12h(closingTime)}
            </span>
          </div>
        </footer>
      )}
    </div>
  );
}
