'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { resolveLogo, resolveBg, resolveLogoGlow, resolveQueueTextTheme } from '@/lib/logos';
import type { Attraction, AttractionStatus } from '@/types/database';

/**
 * BannerBoard — shared compact 4-up "Wait Times" banner board used by TV2.5
 * (full-screen, standalone) and TV4's carousel rides view.
 *
 * Presentational + self-contained scroll: filters to rides, measures its own
 * height, and auto-scrolls 4 banners at a time via a GPU-composited CSS
 * transition (no per-frame JS). No data fetching.
 */

function formatTime12h(time: string): string {
  if (!time) return '--:--';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${m} ${ampm}`;
}

function ClosesPill({ closingTime }: { closingTime: string }) {
  if (!closingTime) return null;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.7vh 1.4vw',
        borderRadius: 999,
        background: 'rgba(245,158,11,0.10)',
        border: '1px solid rgba(245,158,11,0.3)',
        color: '#FCD34D',
        fontSize: '1.7vh',
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      Closes {formatTime12h(closingTime)}
    </span>
  );
}

function ProgressDots({ count, active, glowRgb }: { count: number; active: number; glowRgb: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5vw' }}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            height: '0.6vh',
            borderRadius: '0.3vh',
            width: i === active ? '3vh' : '1.4vh',
            background: i === active ? `rgb(${glowRgb})` : '#2A3038',
          }}
        />
      ))}
    </div>
  );
}

/* ── Static styles ── */

const bgImgStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'center center',
};

const gradientStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'linear-gradient(90deg, transparent 45%, rgba(0,0,0,0.5) 62%, rgba(0,0,0,0.8) 78%, rgba(0,0,0,0.9) 100%), linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.2) 100%)',
  zIndex: 3,
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

const fallbackBgStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(135deg, #15181E 0%, #0A0C10 100%)',
};

const waitColStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: '10vw',
  flexShrink: 0,
};

/* ── BannerRow ── */

const BannerRow = React.memo(function BannerRow({
  attraction,
  style,
}: {
  attraction: Attraction;
  style?: React.CSSProperties;
}) {
  const status = attraction.status as AttractionStatus;
  const bgSrc = resolveBg(attraction);
  const logoSrc = resolveLogo(attraction);
  const logoGlow = resolveLogoGlow(attraction);
  const theme = resolveQueueTextTheme(attraction);

  const rowStyle = useMemo<React.CSSProperties>(
    () => ({
      ...style,
      position: 'relative',
      borderRadius: 0,
      overflow: 'hidden',
      minHeight: 0,
      background: '#0A0C10',
    }),
    [style],
  );

  const logoImgStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'absolute',
      left: '3%',
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 6,
      height: '80%',
      width: 'auto',
      maxWidth: '50%',
      objectFit: 'contain',
      filter: logoGlow || undefined,
    }),
    [logoGlow],
  );

  return (
    <div style={rowStyle}>
      {bgSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bgSrc} alt="" decoding="async" style={bgImgStyle} />
      ) : (
        <div style={fallbackBgStyle} />
      )}
      <div style={gradientStyle} />

      {logoSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoSrc} alt={attraction.name} decoding="async" style={logoImgStyle} />
      )}

      <div style={statusOverlayStyle}>
        <div style={waitColStyle}>
          {status === 'OPEN' && (
            <div key={attraction.wait_time} className="tv-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '4vw', fontWeight: 500, fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: theme.color }}>
                {attraction.wait_time}
              </span>
              <span style={{ fontSize: '0.65vw', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.3em', color: '#475569', marginTop: 3 }}>
                Minutes
              </span>
            </div>
          )}
          {status === 'CLOSED' && (
            <span className="tv-fade" style={{ fontSize: '1.8vw', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#F87171' }}>
              Closed
            </span>
          )}
          {status === 'DELAYED' && (
            <span className="tv-fade" style={{ fontSize: '1.5vw', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#FBBF24', textAlign: 'center', lineHeight: 1.25 }}>
              Technical<br />Delay
            </span>
          )}
          {status === 'AT CAPACITY' && (
            <span className="tv-fade" style={{ fontSize: '1.5vw', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#FBBF24' }}>
              At Capacity
            </span>
          )}
        </div>

        {!logoSrc && (
          <div style={{ position: 'absolute', left: '3%', top: '50%', transform: 'translateY(-50%)', zIndex: 6 }}>
            <span style={{ fontSize: '2vw', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#E2E8F0' }}>
              {attraction.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

/* ── BannerBoard ── */

const SCROLL_INTERVAL = 5000;
const ANIM_DURATION = 600;
const VISIBLE_COUNT = 4;
const GAP = 12;

export default function BannerBoard({
  attractions,
  autoSort = false,
  closingTime,
  showDots = false,
  slideIndex = 0,
  slideCount = 0,
}: {
  attractions: Attraction[];
  autoSort?: boolean;
  closingTime: string;
  showDots?: boolean;
  slideIndex?: number;
  slideCount?: number;
}) {
  const [mainHeight, setMainHeight] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollIndexRef = useRef(0);

  const measureHeight = useCallback(() => {
    if (!mainRef.current) return;
    setMainHeight(mainRef.current.getBoundingClientRect().height);
  }, []);

  useEffect(() => {
    const timer = setTimeout(measureHeight, 100);
    const handleResize = () => measureHeight();
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [measureHeight]);

  // Preload all ride images so they don't pop in while scrolling
  useEffect(() => {
    attractions.forEach((a) => {
      const bg = resolveBg(a);
      const logo = resolveLogo(a);
      if (bg) { const img = new Image(); img.src = bg; }
      if (logo) { const img = new Image(); img.src = logo; }
    });
  }, [attractions]);

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

  const rowHeight = useMemo(() => {
    const count = Math.min(VISIBLE_COUNT, totalRides || 1);
    const totalGap = count > 1 ? (count - 1) * GAP : 0;
    return count > 0 && mainHeight > 0 ? Math.floor((mainHeight - totalGap) / count) : 100;
  }, [totalRides, mainHeight]);

  const stepSize = rowHeight + GAP;

  useEffect(() => {
    scrollIndexRef.current = 0;
    if (scrollRef.current) scrollRef.current.style.transform = 'translateY(0px)';
  }, [totalRides]);

  useEffect(() => {
    if (totalRides <= VISIBLE_COUNT || stepSize <= 0) return;
    let snapTimer: ReturnType<typeof setTimeout> | null = null;

    const interval = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const nextIndex = scrollIndexRef.current + 1;
      el.style.transition = `transform ${ANIM_DURATION}ms ease-out`;
      el.style.transform = `translateY(${-(nextIndex * stepSize)}px)`;
      snapTimer = setTimeout(() => {
        scrollIndexRef.current = nextIndex;
        if (scrollIndexRef.current >= totalRides) {
          scrollIndexRef.current = 0;
          el.style.transition = 'none';
          el.style.transform = 'translateY(0px)';
        }
      }, ANIM_DURATION + 50);
    }, SCROLL_INTERVAL);

    return () => {
      clearInterval(interval);
      if (snapTimer) clearTimeout(snapTimer);
    };
  }, [totalRides, stepSize]);

  const displayRides = useMemo(() => {
    if (totalRides === 0) return [];
    return [...sortedRides, ...sortedRides.slice(0, VISIBLE_COUNT)];
  }, [sortedRides, totalRides]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#07080B',
        display: 'flex',
        flexDirection: 'column',
        padding: '4vh 4vw',
        gap: '2vh',
        overflow: 'hidden',
      }}
    >
      <style>{`.tv-fade{animation:tvbfade 400ms ease}@keyframes tvbfade{from{opacity:0}to{opacity:1}}`}</style>

      {/* Header */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: '1.5vh', borderBottom: '1px solid #15181E' }}>
        <h1 style={{ fontSize: '2.6vh', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#E2E8F0', margin: 0 }}>
          Wait Times
        </h1>
        <ClosesPill closingTime={closingTime} />
      </div>

      {/* Scrolling 4-up banners */}
      <main ref={mainRef} style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div ref={scrollRef} style={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px` }}>
          {displayRides.map((attraction, idx) => (
            <BannerRow
              key={`${attraction.id}-${idx}`}
              attraction={attraction}
              style={{ height: `${rowHeight}px`, minHeight: '60px', flexShrink: 0 }}
            />
          ))}
        </div>
      </main>

      {showDots && (
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
          <ProgressDots count={slideCount} active={slideIndex} glowRgb="251,191,36" />
        </div>
      )}
    </div>
  );
}
