'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import LightningBorder from '@/components/LightningBorder';
import ElectricHeader from '@/components/ElectricHeader';
import type { Attraction, ParkSetting } from '@/types/database';
import { useConnectionHealth } from '@/hooks/useConnectionHealth';
import ParkClosedOverlay from '@/components/ParkClosedOverlay';
import TV1Content from '@/components/tv4/TV1Content';
import TV2Content from '@/components/tv4/TV2Content';
import TV3Content from '@/components/tv4/TV3Content';

function formatTime12h(time: string): string {
  if (!time) return '--:--';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${m} ${ampm}`;
}

/**
 * TV4.5 — Lightweight single-page carousel (no iframes).
 *
 * Renders TV2, TV3, and TV1 content directly as inline components,
 * sharing a single set of Supabase subscriptions and one DOM tree.
 * Designed to run smoothly on Raspberry Pi hardware.
 *
 * Sequence:
 *   TV2 (ride banners, scrolling)  — 30s
 *   TV3 (show schedule grid)       — 15s
 *   TV1 (queue + show times list)  — 15s
 */

const VIEWS = [
  { key: 'tv2', duration: 30000, title: 'Maze Queue Times' },
  { key: 'tv3', duration: 15000, title: 'Show Schedule' },
  { key: 'tv1', duration: 15000, title: 'Mazes & Shows' },
];

const TV_SAFE_PADDING = '3.5%';

export default function TV45Carousel() {
  useConnectionHealth('tv4.5');

  /* ── Shared data layer ── */
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [closingTime, setClosingTime] = useState('');
  const [autoSort, setAutoSort] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [activeIndex, setActiveIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function init() {
      const [attractionsRes, closingRes, autoSortRes] = await Promise.all([
        supabase
          .from('attractions')
          .select('id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at')
          .order('sort_order', { ascending: true }),
        supabase.from('park_settings').select('key,value').eq('key', 'closing_time').single(),
        supabase.from('park_settings').select('key,value').eq('key', 'auto_sort_by_wait').single(),
      ]);

      if (!attractionsRes.error && attractionsRes.data) {
        setAttractions(attractionsRes.data);
      }
      if (closingRes.data) {
        setClosingTime(closingRes.data.value);
      }
      if (autoSortRes.data) {
        setAutoSort(autoSortRes.data.value === 'true');
      }
      setLoading(false);
    }

    init();

    /* ── Single realtime subscription for attractions ── */
    const attractionsChannel = supabase
      .channel('tv45-attractions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attractions' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setAttractions((prev) =>
              prev.map((a) =>
                a.id === (payload.new as Attraction).id ? (payload.new as Attraction) : a,
              ),
            );
          } else if (payload.eventType === 'INSERT') {
            setAttractions((prev) =>
              [...prev, payload.new as Attraction].sort((a, b) => a.sort_order - b.sort_order),
            );
          } else if (payload.eventType === 'DELETE') {
            setAttractions((prev) =>
              prev.filter((a) => a.id !== (payload.old as Attraction).id),
            );
          }
        },
      )
      .subscribe();

    /* ── Single realtime subscription for settings ── */
    const settingsChannel = supabase
      .channel('tv45-settings')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'park_settings' },
        (payload) => {
          const setting = payload.new as ParkSetting;
          if (setting.key === 'closing_time') {
            setClosingTime(setting.value);
          } else if (setting.key === 'auto_sort_by_wait') {
            setAutoSort(setting.value === 'true');
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(attractionsChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, []);

  /* ── 30s ticker for show time advancement ── */
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  /* ── Carousel timer ── */
  useEffect(() => {
    const current = VIEWS[activeIndex];
    timerRef.current = setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % VIEWS.length);
    }, current.duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeIndex]);

  /* ── Derived data ── */
  const rides = attractions.filter((a) => a.attraction_type !== 'show');
  const shows = attractions.filter((a) => a.attraction_type === 'show');

  const sortedRides = autoSort
    ? [...rides].sort((a, b) => {
        const aOpen = a.status === 'OPEN' ? 1 : 0;
        const bOpen = b.status === 'OPEN' ? 1 : 0;
        if (aOpen !== bOpen) return bOpen - aOpen;
        return a.wait_time - b.wait_time;
      })
    : rides;

  /* ── Shared props for content components ── */
  const contentProps = {
    rides: sortedRides,
    shows,
    closingTime,
    now,
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <h1 className="text-white/60 text-2xl font-semibold">Loading...</h1>
      </div>
    );
  }

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
      <ParkClosedOverlay />

      {/* Header */}
      <div style={{ flexShrink: 0 }}>
        <ElectricHeader title={VIEWS[activeIndex].title} fontSize="3vw" />
        <LightningBorder />
      </div>

      {/* Content carousel — opacity-based crossfade */}
      <div className="flex-1 relative overflow-hidden">
        {/* TV2 — Ride Banners */}
        <div
          className="absolute inset-0"
          style={{
            opacity: activeIndex === 0 ? 1 : 0,
            transition: 'opacity 0.5s ease-in-out',
            pointerEvents: activeIndex === 0 ? 'auto' : 'none',
          }}
        >
          <TV2Content {...contentProps} isActive={activeIndex === 0} />
        </div>

        {/* TV3 — Show Schedule */}
        <div
          className="absolute inset-0"
          style={{
            opacity: activeIndex === 1 ? 1 : 0,
            transition: 'opacity 0.5s ease-in-out',
            pointerEvents: activeIndex === 1 ? 'auto' : 'none',
          }}
        >
          <TV3Content {...contentProps} isActive={activeIndex === 1} />
        </div>

        {/* TV1 — Mazes & Shows */}
        <div
          className="absolute inset-0"
          style={{
            opacity: activeIndex === 2 ? 1 : 0,
            transition: 'opacity 0.5s ease-in-out',
            pointerEvents: activeIndex === 2 ? 'auto' : 'none',
          }}
        >
          <TV1Content {...contentProps} isActive={activeIndex === 2} />
        </div>
      </div>

      {/* Footer */}
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
    </div>
  );
}
