'use client';

import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { getAttractionLogo, getAttractionBg } from '@/lib/logos';
import type { Attraction, AttractionStatus } from '@/types/database';
import type { TV4ContentProps } from './types';

/* ── Static styles ── */

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

  return (
    <div style={rowStyle}>
      {bgSrc ? (
        <img src={bgSrc} alt="" style={bgImgStyle} />
      ) : (
        <div style={fallbackBgStyle} />
      )}
      <div style={darkenStyle} />
      <div style={gradientStyle} />

      {logoSrc && (
        <img src={logoSrc} alt={attraction.name} style={logoStyle} />
      )}

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
            <span style={{ fontSize: '2.5vw', fontWeight: 900 }}>
              {attraction.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

/* ── Constants ── */

const SCROLL_INTERVAL = 5000;
const ANIM_DURATION = 600;
const VISIBLE_COUNT = 2;
const GAP = 20;

/* ── Main Component ── */

export default function TV2Content({ rides, isActive }: TV4ContentProps) {
  const [mainHeight, setMainHeight] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollIndexRef = useRef(0);
  const prevActiveRef = useRef(false);

  const measureHeight = useCallback(() => {
    if (!mainRef.current) return;
    setMainHeight(mainRef.current.getBoundingClientRect().height);
  }, []);

  // Measure container height on mount + resize
  useEffect(() => {
    const timer = setTimeout(measureHeight, 100);
    const handleResize = () => measureHeight();
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [measureHeight]);

  // Preload all attraction images
  useEffect(() => {
    if (rides.length === 0) return;
    rides.forEach((a) => {
      const bg = getAttractionBg(a.slug);
      const logo = getAttractionLogo(a.slug);
      if (bg) { const img = new Image(); img.src = bg; }
      if (logo) { const img = new Image(); img.src = logo; }
    });
  }, [rides]);

  const totalRides = rides.length;

  // Row height: space for VISIBLE_COUNT cards with gaps
  const rowHeight = useMemo(() => {
    const count = Math.min(VISIBLE_COUNT, totalRides || 1);
    const totalGap = count > 1 ? (count - 1) * GAP : 0;
    return count > 0 && mainHeight > 0
      ? Math.floor((mainHeight - totalGap) / count)
      : 100;
  }, [totalRides, mainHeight]);

  const stepSize = rowHeight + GAP;

  // Reset scroll when rides change
  useEffect(() => {
    scrollIndexRef.current = 0;
    if (scrollRef.current) {
      scrollRef.current.style.transform = 'translateY(0px)';
    }
  }, [totalRides]);

  // Reset scroll when becoming active (replaces postMessage)
  useEffect(() => {
    if (isActive && !prevActiveRef.current) {
      scrollIndexRef.current = 0;
      const el = scrollRef.current;
      if (el) {
        el.style.transition = 'none';
        el.style.transform = 'translateY(0px)';
      }
    }
    prevActiveRef.current = isActive;
  }, [isActive]);

  // Scroll interval — only runs when active (saves CPU when not visible)
  useEffect(() => {
    if (!isActive || totalRides <= VISIBLE_COUNT || stepSize <= 0) return;

    const interval = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;

      const nextIndex = scrollIndexRef.current + 1;

      el.style.transition = `transform ${ANIM_DURATION}ms ease-out`;
      el.style.transform = `translateY(${-(nextIndex * stepSize)}px)`;

      setTimeout(() => {
        scrollIndexRef.current = nextIndex;
        if (scrollIndexRef.current >= totalRides) {
          scrollIndexRef.current = 0;
          el.style.transition = 'none';
          el.style.transform = 'translateY(0px)';
        }
      }, ANIM_DURATION + 50);
    }, SCROLL_INTERVAL);

    return () => clearInterval(interval);
  }, [isActive, totalRides, stepSize]);

  // Build display list with wrap duplicates
  const displayRides = useMemo(() => {
    if (totalRides === 0) return [];
    return [...rides, ...rides.slice(0, VISIBLE_COUNT)];
  }, [rides, totalRides]);

  return (
    <div ref={mainRef} style={{ height: '100%', overflow: 'hidden', position: 'relative' }}>
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
    </div>
  );
}
