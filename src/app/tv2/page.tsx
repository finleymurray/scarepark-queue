'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Attraction, AttractionStatus, ParkSetting } from '@/types/database';

/** Cache-bust version — bump when images change */
const IMG_V = '2';

/** Map attraction slug to banner image path */
const BANNER_IMAGES: Record<string, string> = {
  'the-bunker': `/Queue Board Images/the-bunker.webp?v=${IMG_V}`,
  'night-terrors': `/Queue Board Images/night-terrors.webp?v=${IMG_V}`,
  'westlake-witch-trials': `/Queue Board Images/westlake-witch-trials.webp?v=${IMG_V}`,
  'drowned': `/Queue Board Images/drowned.webp?v=${IMG_V}`,
  'strings-of-control': `/Queue Board Images/strings-of-control.webp?v=${IMG_V}`,
  'signal-loss': `/Queue Board Images/signal-loss.webp?v=${IMG_V}`,
};

// Static style objects — defined once, never recreated
const imgStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'left center',
};
const fallbackBgStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundColor: 'rgba(34, 197, 94, 0.06)',
  border: '1px solid rgba(34, 197, 94, 0.15)',
  borderRadius: '1rem',
};
const gradientStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(to right, transparent 65%, rgba(0,0,0,0.85) 100%)',
  zIndex: 5,
};
const statusOverlayStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  height: '100%',
  paddingRight: '5%',
  paddingLeft: '3%',
};
const closedStyle: React.CSSProperties = {
  color: '#dc3545',
  fontSize: '2.5rem',
  textShadow: '0 2px 12px rgba(0,0,0,0.9)',
  letterSpacing: '0.05em',
};
const delayedStyle: React.CSSProperties = {
  color: '#f0ad4e',
  fontSize: '2rem',
  textShadow: '0 2px 12px rgba(0,0,0,0.9)',
  letterSpacing: '0.05em',
};
const capacityStyle: React.CSSProperties = {
  color: '#F59E0B',
  fontSize: '2.2rem',
  textShadow: '0 2px 12px rgba(0,0,0,0.9)',
  letterSpacing: '0.05em',
};
const openWrapStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  color: 'white',
  textShadow: '0 2px 12px rgba(0,0,0,0.9)',
  lineHeight: 1,
};
const waitTimeStyle: React.CSSProperties = { fontSize: '4rem' };
const minsStyle: React.CSSProperties = { fontSize: '0.9rem', opacity: 0.7, marginTop: '2px' };
const fallbackNameStyle: React.CSSProperties = { flex: 1, minWidth: 0, marginRight: '1.5rem' };

const BannerRow = React.memo(function BannerRow({ attraction, style }: { attraction: Attraction; style?: React.CSSProperties }) {
  const status = attraction.status as AttractionStatus;
  const bannerSrc = BANNER_IMAGES[attraction.slug];

  const rowStyle = useMemo<React.CSSProperties>(() => ({
    ...style,
    position: 'relative',
    borderRadius: '1rem',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.08)',
  }), [style]);

  return (
    <div style={rowStyle}>
      {bannerSrc && (
        <img src={bannerSrc} alt={attraction.name} style={imgStyle} />
      )}
      {!bannerSrc && <div style={fallbackBgStyle} />}
      {bannerSrc && <div style={gradientStyle} />}

      <div style={statusOverlayStyle}>
        {!bannerSrc && (
          <div style={fallbackNameStyle}>
            <h3 className="text-white text-2xl font-bold truncate">
              {attraction.name}
            </h3>
          </div>
        )}

        <div className="flex-shrink-0 text-right">
          {status === 'CLOSED' && (
            <span className="font-black uppercase tracking-wider" style={closedStyle}>
              Closed
            </span>
          )}
          {status === 'DELAYED' && (
            <span className="font-black uppercase tracking-wider" style={delayedStyle}>
              Technical Delay
            </span>
          )}
          {status === 'AT CAPACITY' && (
            <span className="font-black uppercase tracking-wider" style={capacityStyle}>
              At Capacity
            </span>
          )}
          {status === 'OPEN' && (
            <div style={openWrapStyle}>
              <span className="font-black tabular-nums" style={waitTimeStyle}>
                {attraction.wait_time}
              </span>
              <span className="font-bold uppercase tracking-widest" style={minsStyle}>
                Mins
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

const PAGE_INTERVAL = 10000;
const TV_SAFE_PADDING = '3.5%';

export default function TV2Display() {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [autoSort, setAutoSort] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [fading, setFading] = useState(false);
  const [mainHeight, setMainHeight] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);
  const perPage = 2;

  const measureHeight = useCallback(() => {
    if (!mainRef.current) return;
    setMainHeight(mainRef.current.getBoundingClientRect().height);
  }, []);

  useEffect(() => {
    async function fetchData() {
      const [attractionsRes, autoSortRes] = await Promise.all([
        supabase.from('attractions').select('id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at').order('sort_order', { ascending: true }),
        supabase.from('park_settings').select('key,value').eq('key', 'auto_sort_by_wait').single(),
      ]);

      if (!attractionsRes.error) {
        setAttractions(attractionsRes.data || []);
      }
      if (autoSortRes.data) {
        setAutoSort(autoSortRes.data.value === 'true');
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
                a.id === (payload.new as Attraction).id ? (payload.new as Attraction) : a
              )
            );
          } else if (payload.eventType === 'INSERT') {
            setAttractions((prev) =>
              [...prev, payload.new as Attraction].sort((a, b) => a.sort_order - b.sort_order)
            );
          } else if (payload.eventType === 'DELETE') {
            setAttractions((prev) =>
              prev.filter((a) => a.id !== (payload.old as Attraction).id)
            );
          }
        }
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
        }
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

  const totalPages = sortedRides.length > perPage
    ? Math.ceil(sortedRides.length / perPage)
    : 1;

  useEffect(() => {
    if (totalPages <= 1) {
      setCurrentPage(0);
      return;
    }

    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setCurrentPage((prev) => (prev + 1) % totalPages);
        setFading(false);
      }, 400);
    }, PAGE_INTERVAL);

    return () => clearInterval(interval);
  }, [totalPages]);

  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(0);
    }
  }, [currentPage, totalPages]);

  const visibleRides = totalPages > 1
    ? sortedRides.slice(currentPage * perPage, (currentPage + 1) * perPage)
    : sortedRides;

  const count = visibleRides.length;
  const gap = 20;
  const totalGap = count > 1 ? (count - 1) * gap : 0;
  const rowHeight = count > 0 && mainHeight > 0
    ? Math.floor((mainHeight - totalGap) / count)
    : 100;

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
        paddingLeft: TV_SAFE_PADDING,
        paddingRight: TV_SAFE_PADDING,
        paddingTop: '2%',
        paddingBottom: '2%',
      }}
    >
      {/* Ride list — fills available space */}
      <main ref={mainRef} className="flex-1 overflow-hidden">
        <div
          className="h-full flex flex-col transition-opacity duration-400"
          style={{
            opacity: fading ? 0 : 1,
            gap: `${gap}px`,
          }}
        >
          {visibleRides.map((attraction) => (
            <BannerRow
              key={attraction.id}
              attraction={attraction}
              style={{ height: `${rowHeight}px`, minHeight: '80px' }}
            />
          ))}
        </div>
      </main>

      {/* Page dots — below attraction boxes */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            paddingTop: '12px',
            flexShrink: 0,
          }}
        >
          {Array.from({ length: totalPages }).map((_, i) => (
            <div
              key={i}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: i === currentPage ? 'white' : 'rgba(255,255,255,0.4)',
                transition: 'background-color 0.3s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
