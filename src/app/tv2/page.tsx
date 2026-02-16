'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { getAttractionLogo, getAttractionBg } from '@/lib/logos';
import LightningBorder from '@/components/LightningBorder';
import ElectricHeader from '@/components/ElectricHeader';
import type { Attraction, AttractionStatus, ParkSetting } from '@/types/database';
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

/* ── Static styles ── */

const headerStyle: React.CSSProperties = {
  padding: '1.5vw 0 0',
  textAlign: 'center' as const,
  marginBottom: '0.8vw',
  flexShrink: 0,
};

const headerTitleStyle: React.CSSProperties = {
  fontSize: '2.2vw',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.2em',
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

const bgImgStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'center center',
};

const darkenStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.15)',
  zIndex: 2,
};

const gradientStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'linear-gradient(to right, transparent 35%, rgba(0,0,0,0.4) 55%, rgba(0,0,0,0.75) 72%, rgba(0,0,0,0.92) 85%, rgba(0,0,0,0.98) 100%), linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.15) 100%)',
  zIndex: 3,
};

const logoStyle: React.CSSProperties = {
  position: 'absolute',
  left: '3%',
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 6,
  height: '85%',
  width: 'auto',
  maxWidth: '55%',
  objectFit: 'contain',
};

const statusOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  paddingRight: '4%',
  paddingLeft: '3%',
};

/* Status text styles — no pill containers, just coloured text within gradient fade */

/* Fallback when no background art exists */
const fallbackBgStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(135deg, rgba(30,30,30,0.9) 0%, rgba(15,15,15,0.95) 100%)',
};

/* ── BannerRow Component ── */

const BannerRow = React.memo(function BannerRow({
  attraction,
  style,
}: {
  attraction: Attraction;
  style?: React.CSSProperties;
}) {
  const status = attraction.status as AttractionStatus;
  const bgSrc = getAttractionBg(attraction.slug);
  const logoSrc = getAttractionLogo(attraction.slug);

  const rowStyle = useMemo<React.CSSProperties>(
    () => ({
      ...style,
      position: 'relative',
      borderRadius: 0,
      overflow: 'hidden',
      minHeight: 0,
    }),
    [style],
  );

  // No glow filter on TV2 — drop-shadow filters are too expensive during scroll animation
  const logoImgStyle = logoStyle;

  return (
    <div style={rowStyle}>
      {/* Background art */}
      {bgSrc ? (
        <img src={bgSrc} alt="" style={bgImgStyle} />
      ) : (
        <div style={fallbackBgStyle} />
      )}
      <div style={darkenStyle} />
      <div style={gradientStyle} />

      {/* Logo overlay */}
      {logoSrc && (
        <img src={logoSrc} alt={attraction.name} style={logoImgStyle} />
      )}

      {/* Status / wait time — no pill, text sits within the gradient fade */}
      <div style={statusOverlayStyle}>
        {status === 'OPEN' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '7vw',
                fontWeight: 900,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
                color: '#fff',
              }}
            >
              {attraction.wait_time}
            </span>
            <span
              style={{
                fontSize: '1.2vw',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                color: 'rgba(255,255,255,0.45)',
                marginTop: 4,
              }}
            >
              Minutes
            </span>
          </div>
        )}
        {status === 'CLOSED' && (
          <span
            style={{
              fontSize: '2.2vw',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#f87171',
            }}
          >
            Closed
          </span>
        )}
        {status === 'DELAYED' && (
          <span
            style={{
              fontSize: '2vw',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#f0ad4e',
              textAlign: 'center' as const,
              lineHeight: 1.2,
            }}
          >
            Technical<br />Delay
          </span>
        )}
        {status === 'AT CAPACITY' && (
          <span
            style={{
              fontSize: '2vw',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#F59E0B',
            }}
          >
            At Capacity
          </span>
        )}

        {/* Fallback: show name if no logo */}
        {!logoSrc && (
          <div
            style={{
              position: 'absolute',
              left: '3%',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 6,
            }}
          >
            <span
              style={{
                fontSize: '2.5vw',
                fontWeight: 900,
              }}
            >
              {attraction.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

/* ── Main page ── */

const SCROLL_INTERVAL = 5000;
const ANIM_DURATION = 600;
const VISIBLE_COUNT = 2;
const GAP = 20;
const TV_SAFE_PADDING = '3.5%';

export default function TV25Display() {
  useConnectionHealth('tv2');
  useScreenAssignment();
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [autoSort, setAutoSort] = useState(false);
  const [closingTime, setClosingTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [mainHeight, setMainHeight] = useState(0);
  const [isEmbedded, setIsEmbedded] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  // Scroll state — use refs to avoid React re-render issues on TV browsers
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollIndexRef = useRef(0);

  useEffect(() => {
    setIsEmbedded(window.self !== window.top);
  }, []);

  const measureHeight = useCallback(() => {
    if (!mainRef.current) return;
    setMainHeight(mainRef.current.getBoundingClientRect().height);
  }, []);

  useEffect(() => {
    async function fetchData() {
      const [attractionsRes, autoSortRes, closingRes] = await Promise.all([
        supabase
          .from('attractions')
          .select('id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at')
          .order('sort_order', { ascending: true }),
        supabase.from('park_settings').select('key,value').eq('key', 'auto_sort_by_wait').single(),
        supabase.from('park_settings').select('key,value').eq('key', 'closing_time').single(),
      ]);

      if (!attractionsRes.error) {
        setAttractions(attractionsRes.data || []);
      }
      if (autoSortRes.data) {
        setAutoSort(autoSortRes.data.value === 'true');
      }
      if (closingRes.data) {
        setClosingTime(closingRes.data.value);
      }
      setLoading(false);
    }

    fetchData();

    const attractionsChannel = supabase
      .channel('tv25-attractions')
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

    const settingsChannel = supabase
      .channel('tv25-settings')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'park_settings' },
        (payload) => {
          const setting = payload.new as ParkSetting;
          if (setting.key === 'auto_sort_by_wait') {
            setAutoSort(setting.value === 'true');
          }
          if (setting.key === 'closing_time') {
            setClosingTime(setting.value);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(attractionsChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    const timer = setTimeout(measureHeight, 100);

    const handleResize = () => measureHeight();
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [loading, measureHeight]);

  // Preload all attraction images so they don't pop in when scrolling
  useEffect(() => {
    if (attractions.length === 0) return;
    attractions.forEach((a) => {
      const bg = getAttractionBg(a.slug);
      const logo = getAttractionLogo(a.slug);
      if (bg) { const img = new Image(); img.src = bg; }
      if (logo) { const img = new Image(); img.src = logo; }
    });
  }, [attractions]);

  // Filter to rides only, then sort if enabled
  const sortedRides = useMemo(() => {
    const rides = attractions.filter((a) => a.attraction_type !== 'show');
    if (!autoSort) return rides;
    return [...rides].sort((a, b) => {
      const aOpen = a.status === 'OPEN' ? 1 : 0;
      const bOpen = b.status === 'OPEN' ? 1 : 0;
      if (aOpen !== bOpen) return bOpen - aOpen;
      return a.wait_time - b.wait_time;
    });
  }, [attractions, autoSort]);

  const totalRides = sortedRides.length;

  // Row height: space for VISIBLE_COUNT cards with gaps
  const rowHeight = useMemo(() => {
    const count = Math.min(VISIBLE_COUNT, totalRides || 1);
    const totalGap = count > 1 ? (count - 1) * GAP : 0;
    return count > 0 && mainHeight > 0
      ? Math.floor((mainHeight - totalGap) / count)
      : 100;
  }, [totalRides, mainHeight]);

  // Step size = one row height + gap
  const stepSize = rowHeight + GAP;

  // Reset scroll index when rides change
  useEffect(() => {
    scrollIndexRef.current = 0;
    if (scrollRef.current) {
      scrollRef.current.style.transform = 'translateY(0px)';
    }
  }, [totalRides]);

  // Listen for reset-scroll messages from TV4 carousel parent
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'tv4-reset-scroll') {
        scrollIndexRef.current = 0;
        const el = scrollRef.current;
        if (el) {
          el.style.transition = 'none';
          el.style.transform = 'translateY(0px)';
        }
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Scroll via CSS transition + setTimeout (GPU-composited, no per-frame JS)
  useEffect(() => {
    if (totalRides <= VISIBLE_COUNT || stepSize <= 0) return;

    const interval = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;

      const nextIndex = scrollIndexRef.current + 1;

      // Enable CSS transition and move to next position
      el.style.transition = `transform ${ANIM_DURATION}ms ease-out`;
      el.style.transform = `translateY(${-(nextIndex * stepSize)}px)`;

      // After transition completes, check if we need to snap back
      setTimeout(() => {
        scrollIndexRef.current = nextIndex;
        if (scrollIndexRef.current >= totalRides) {
          scrollIndexRef.current = 0;
          // Instant snap back — disable transition, reset position
          el.style.transition = 'none';
          el.style.transform = 'translateY(0px)';
        }
      }, ANIM_DURATION + 50);
    }, SCROLL_INTERVAL);

    return () => clearInterval(interval);
  }, [totalRides, stepSize]);

  // Build the display list: original rides + just enough duplicates for seamless wrap
  const displayRides = useMemo(() => {
    if (totalRides === 0) return [];
    // Only duplicate enough cards to fill the viewport during the wrap transition
    return [...sortedRides, ...sortedRides.slice(0, VISIBLE_COUNT)];
  }, [sortedRides, totalRides]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <h1 className="text-white/60 text-2xl font-semibold">Loading...</h1>
      </div>
    );
  }

  return (
    <div
      className="h-screen bg-black flex flex-col overflow-hidden"
      style={{
        paddingLeft: isEmbedded ? 0 : TV_SAFE_PADDING,
        paddingRight: isEmbedded ? 0 : TV_SAFE_PADDING,
        paddingTop: isEmbedded ? 0 : '2%',
        paddingBottom: isEmbedded ? 0 : '2%',
      }}
    >
      {/* Header */}
      {!isEmbedded && (
        <div style={{ flexShrink: 0 }}>
          <ElectricHeader title="Maze Queue Times" fontSize="3.5vw" />
          <LightningBorder />
        </div>
      )}

      {/* Scrolling ride banners */}
      <main ref={mainRef} className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
        <div
          ref={scrollRef}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: `${GAP}px`,
          }}
        >
          {displayRides.map((attraction, idx) => (
            <BannerRow
              key={`${attraction.id}-${idx}`}
              attraction={attraction}
              style={{ height: `${rowHeight}px`, minHeight: '80px', flexShrink: 0 }}
            />
          ))}
        </div>
      </main>

      {/* Footer */}
      {!isEmbedded && (
        <div style={{ flexShrink: 0 }}>
          <LightningBorder />
          <div style={{ textAlign: 'center', padding: '0.3vw 0' }}>
            <span style={{ fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif", fontSize: '1vw', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)' }}>
              Park Closes{' '}
            </span>
            <span style={{ fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif", fontSize: '1.7vw', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.7)' }}>
              {formatTime12h(closingTime)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
