'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { getAttractionLogo, getAttractionBg, getLogoGlow } from '@/lib/logos';
import type { Attraction, AttractionStatus, ParkSetting } from '@/types/database';

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
  background:
    'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.04) 0%, transparent 70%), linear-gradient(180deg, rgba(30,30,30,0.95) 0%, rgba(15,15,15,0.95) 100%)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  padding: '18px 40px',
  textAlign: 'center' as const,
  marginBottom: 12,
  flexShrink: 0,
  boxShadow:
    '0 4px 12px rgba(0,0,0,0.4)',
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
    '0 4px 12px rgba(0,0,0,0.4)',
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
    'linear-gradient(to right, transparent 40%, rgba(0,0,0,0.5) 65%, rgba(0,0,0,0.88) 85%, rgba(0,0,0,0.97) 100%), linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)',
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

/* Pill styles */
const pillBaseStyle: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.75)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 14,
  padding: '10px 28px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
};

const pillOpenStyle: React.CSSProperties = {
  ...pillBaseStyle,
  padding: '10px 0',
  width: '8vw',
};

const pillClosedStyle: React.CSSProperties = {
  ...pillBaseStyle,
  background: 'rgba(220, 53, 69, 0.2)',
  border: '1px solid rgba(220, 53, 69, 0.3)',
};

const pillDelayedStyle: React.CSSProperties = {
  ...pillBaseStyle,
  background: 'rgba(240, 173, 78, 0.18)',
  border: '1px solid rgba(240, 173, 78, 0.3)',
};

const pillCapacityStyle: React.CSSProperties = {
  ...pillBaseStyle,
  background: 'rgba(245, 158, 11, 0.18)',
  border: '1px solid rgba(245, 158, 11, 0.3)',
};

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
  const glow = getLogoGlow(attraction.slug, 'strong');

  const rowStyle = useMemo<React.CSSProperties>(
    () => ({
      ...style,
      position: 'relative',
      borderRadius: '1rem',
      overflow: 'hidden',
      minHeight: 0,
      border: '1px solid rgba(255,255,255,0.12)',
      boxShadow:
        '0 8px 24px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
    }),
    [style],
  );

  const logoImgStyle = useMemo<React.CSSProperties>(
    () => ({
      ...logoStyle,
      filter: glow || undefined,
    }),
    [glow],
  );

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

      {/* Status pill */}
      <div style={statusOverlayStyle}>
        {status === 'OPEN' && (
          <div style={pillOpenStyle}>
            <span
              style={{
                fontSize: '4.5vw',
                fontWeight: 900,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
                textShadow: '0 0 12px rgba(255,255,255,0.3), 0 0 30px rgba(255,255,255,0.12)',
              }}
            >
              {attraction.wait_time}
            </span>
            <span
              style={{
                fontSize: '0.9vw',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: 'rgba(255,255,255,0.5)',
                marginTop: 2,
              }}
            >
              Mins
            </span>
          </div>
        )}
        {status === 'CLOSED' && (
          <div style={pillClosedStyle}>
            <span
              style={{
                fontSize: '2vw',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#f87171',
                textShadow: '0 0 10px rgba(220, 53, 69, 0.5), 0 0 25px rgba(220, 53, 69, 0.25)',
              }}
            >
              Closed
            </span>
          </div>
        )}
        {status === 'DELAYED' && (
          <div style={pillDelayedStyle}>
            <span
              style={{
                fontSize: '1.6vw',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#f0ad4e',
                textShadow: '0 0 10px rgba(240, 173, 78, 0.5), 0 0 25px rgba(240, 173, 78, 0.25)',
              }}
            >
              Technical Delay
            </span>
          </div>
        )}
        {status === 'AT CAPACITY' && (
          <div style={pillCapacityStyle}>
            <span
              style={{
                fontSize: '1.6vw',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#F59E0B',
                textShadow: '0 0 10px rgba(245, 158, 11, 0.5), 0 0 25px rgba(245, 158, 11, 0.25)',
              }}
            >
              At Capacity
            </span>
          </div>
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
                textShadow: '0 0 12px rgba(255,255,255,0.3)',
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

const PAGE_INTERVAL = 10000;
const FADE_DURATION = 400;
const TV_SAFE_PADDING = '3.5%';

export default function TV2Display() {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [autoSort, setAutoSort] = useState(false);
  const [closingTime, setClosingTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [mainHeight, setMainHeight] = useState(0);
  const [isEmbedded, setIsEmbedded] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const pageRefsMap = useRef<Map<number, HTMLDivElement>>(new Map());
  const perPage = 2;

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
      .channel('tv2-attractions')
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
      .channel('tv2-settings')
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

  // Filter to rides only (no shows), then sort if enabled
  const sortedRides = useMemo(() => {
    const rides = attractions.filter((a) => a.attraction_type !== 'show');
    if (!autoSort) return rides;
    return [...rides].sort((a, b) => {
      const aOpen = a.status === 'OPEN' ? 1 : 0;
      const bOpen = b.status === 'OPEN' ? 1 : 0;
      if (aOpen !== bOpen) return bOpen - aOpen;
      return b.wait_time - a.wait_time;
    });
  }, [attractions, autoSort]);

  // Build pages array — each page is a slice of rides
  const pages = useMemo(() => {
    const result: Attraction[][] = [];
    for (let i = 0; i < sortedRides.length; i += perPage) {
      result.push(sortedRides.slice(i, i + perPage));
    }
    return result.length > 0 ? result : [[]];
  }, [sortedRides]);

  const totalPages = pages.length;

  const gap = 20;
  const rowHeight = useMemo(() => {
    const count = Math.min(perPage, sortedRides.length || 1);
    const totalGap = count > 1 ? (count - 1) * gap : 0;
    return count > 0 && mainHeight > 0
      ? Math.floor((mainHeight - totalGap) / count)
      : 100;
  }, [sortedRides.length, mainHeight]);

  // Fade via inline CSS transition + setTimeout (GPU-composited, no per-frame JS)
  useEffect(() => {
    if (totalPages <= 1) {
      setCurrentPage(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentPage((prev) => {
        const oldPage = prev;
        const newPage = (prev + 1) % totalPages;

        const oldEl = pageRefsMap.current.get(oldPage);
        const newEl = pageRefsMap.current.get(newPage);

        // Trigger CSS transition: fade out old, fade in new
        if (oldEl) oldEl.style.opacity = '0';
        if (newEl) newEl.style.opacity = '1';

        // After transition completes, update pointerEvents
        setTimeout(() => {
          if (oldEl) oldEl.style.pointerEvents = 'none';
          if (newEl) newEl.style.pointerEvents = 'auto';
        }, FADE_DURATION);

        return newPage;
      });
    }, PAGE_INTERVAL);

    return () => clearInterval(interval);
  }, [totalPages]);

  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(0);
    }
  }, [currentPage, totalPages]);

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
        <div style={headerStyle}>
          <h1 style={headerTitleStyle}>Live Times</h1>
        </div>
      )}

      {/* Section divider */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '4px 8px',
          marginBottom: 8,
        }}
      >
        <div
          style={{
            flex: 1,
            height: 1,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.15))',
          }}
        />
        <span
          style={{
            fontSize: '0.85vw',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            flexShrink: 0,
            color: 'rgba(255,255,255,0.35)',
          }}
        >
          Attractions
        </span>
        <div
          style={{
            flex: 1,
            height: 1,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.15), rgba(255,255,255,0.02))',
          }}
        />
      </div>

      {/* Ride banners — all pages stay mounted, only active page visible */}
      <main ref={mainRef} className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
        {pages.map((pageRides, pageIndex) => (
          <div
            key={pageIndex}
            ref={(el) => {
              if (el) pageRefsMap.current.set(pageIndex, el);
              else pageRefsMap.current.delete(pageIndex);
            }}
            className="flex flex-col"
            style={{
              position: 'absolute',
              inset: 0,
              opacity: pageIndex === currentPage ? 1 : 0,
              pointerEvents: pageIndex === currentPage ? 'auto' : 'none',
              gap: `${gap}px`,
              transition: `opacity ${FADE_DURATION}ms ease`,
            }}
          >
            {pageRides.map((attraction) => (
              <BannerRow
                key={attraction.id}
                attraction={attraction}
                style={{ height: `${rowHeight}px`, minHeight: '80px' }}
              />
            ))}
          </div>
        ))}
      </main>

      {/* Page dots */}
      {totalPages > 1 && !isEmbedded && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 10,
            paddingTop: 12,
            flexShrink: 0,
          }}
        >
          {Array.from({ length: totalPages }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background:
                  i === currentPage ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)',
                border:
                  i === currentPage
                    ? '1px solid rgba(255,255,255,0.5)'
                    : '1px solid rgba(255,255,255,0.1)',
                boxShadow:
                  i === currentPage
                    ? '0 0 6px rgba(255,255,255,0.5), 0 0 14px rgba(255,255,255,0.2)'
                    : 'none',
                transition: 'all 0.3s',
              }}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      {!isEmbedded && (
        <div style={footerStyle}>
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
              textShadow: '0 0 10px rgba(255,255,255,0.2), 0 0 25px rgba(255,255,255,0.08)',
            }}
          >
            {formatTime12h(closingTime)}
          </span>
        </div>
      )}
    </div>
  );
}
