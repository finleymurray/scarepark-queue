'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Attraction, AttractionStatus, ParkSetting } from '@/types/database';

/** Map attraction slug to banner image path */
const BANNER_IMAGES: Record<string, string> = {
  'the-bunker': '/Queue Board Images/the-bunker.png',
  'night-terrors': '/Queue Board Images/night-terrors.png',
  'westlake-witch-trials': '/Queue Board Images/westlake-witch-trials.png',
  'drowned': '/Queue Board Images/drowned.png',
  'strings-of-control': '/Queue Board Images/strings-of-control.png',
};

function ClockIcon() {
  return (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function formatTime12h(time: string): string {
  if (!time) return '--:--';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${m} ${ampm}`;
}

function BannerRow({ attraction, style }: { attraction: Attraction; style?: React.CSSProperties }) {
  const status = attraction.status as AttractionStatus;
  const bannerSrc = BANNER_IMAGES[attraction.slug];

  return (
    <div
      className="relative rounded-lg overflow-hidden"
      style={{
        ...style,
      }}
    >
      {/* Banner image — full bleed */}
      {bannerSrc && (
        <img
          src={bannerSrc}
          alt={attraction.name}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'left center',
          }}
        />
      )}

      {/* Fallback if no banner */}
      {!bannerSrc && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(34, 197, 94, 0.06)',
            border: '1px solid rgba(34, 197, 94, 0.15)',
            borderRadius: '0.5rem',
          }}
        />
      )}

      {/* Status overlay — positioned on the right */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          height: '100%',
          paddingRight: '4%',
          paddingLeft: '3%',
        }}
      >
        {/* Fallback name if no banner */}
        {!bannerSrc && (
          <div style={{ flex: 1, minWidth: 0, marginRight: '1.5rem' }}>
            <h3 className="text-white text-2xl font-bold truncate">
              {attraction.name}
            </h3>
          </div>
        )}

        <div className="flex-shrink-0 text-right">
          {status === 'CLOSED' && (
            <span
              className="font-bold italic"
              style={{ color: '#dc3545', fontSize: '2rem', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
            >
              Closed
            </span>
          )}
          {status === 'DELAYED' && (
            <span
              className="font-bold"
              style={{ color: '#f0ad4e', fontSize: '2rem', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
            >
              Technical Delay
            </span>
          )}
          {status === 'AT CAPACITY' && (
            <span
              className="font-bold"
              style={{ color: '#F59E0B', fontSize: '2rem', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
            >
              At Capacity
            </span>
          )}
          {status === 'OPEN' && (
            <div className="flex items-center gap-3" style={{ color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
              <ClockIcon />
              <span className="font-black tabular-nums" style={{ fontSize: '2.5rem' }}>
                {attraction.wait_time}
              </span>
              <span
                className="font-semibold uppercase tracking-wider"
                style={{ fontSize: '1rem', opacity: 0.7 }}
              >
                Mins
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const PAGE_INTERVAL = 10000;
const TV_SAFE_PADDING = '3.5%';

export default function TV2Display() {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [closingTime, setClosingTime] = useState('');
  const [autoSort, setAutoSort] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [perPage, setPerPage] = useState<number | null>(null);
  const [fading, setFading] = useState(false);
  const [mainHeight, setMainHeight] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);

  const calculatePerPage = useCallback(() => {
    if (!mainRef.current) return;
    const available = mainRef.current.getBoundingClientRect().height;
    setMainHeight(available);
    const estimatedRowHeight = 120;
    const fits = Math.max(1, Math.floor(available / estimatedRowHeight));
    setPerPage(fits);
  }, []);

  useEffect(() => {
    async function fetchData() {
      const [attractionsRes, closingRes, autoSortRes] = await Promise.all([
        supabase.from('attractions').select('*').order('sort_order', { ascending: true }),
        supabase.from('park_settings').select('*').eq('key', 'closing_time').single(),
        supabase.from('park_settings').select('*').eq('key', 'auto_sort_by_wait').single(),
      ]);

      if (!attractionsRes.error) {
        setAttractions(attractionsRes.data || []);
      }
      if (closingRes.data) {
        setClosingTime(closingRes.data.value);
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
          if (setting.key === 'closing_time') {
            setClosingTime(setting.value);
          } else if (setting.key === 'auto_sort_by_wait') {
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

    const timer = setTimeout(calculatePerPage, 100);

    const handleResize = () => calculatePerPage();
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [loading, calculatePerPage]);

  // Filter to rides only (no shows)
  const rides = attractions.filter((a) => a.attraction_type !== 'show');

  const sortedRides = autoSort
    ? [...rides].sort((a, b) => {
        const aOpen = a.status === 'OPEN' ? 1 : 0;
        const bOpen = b.status === 'OPEN' ? 1 : 0;
        if (aOpen !== bOpen) return bOpen - aOpen;
        return b.wait_time - a.wait_time;
      })
    : rides;

  const totalPages = perPage && perPage < sortedRides.length
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

  const visibleRides = perPage && totalPages > 1
    ? sortedRides.slice(currentPage * perPage, (currentPage + 1) * perPage)
    : sortedRides;

  const count = visibleRides.length;
  const gap = 12;
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
      {/* Header banner */}
      <header className="bg-[#0a0a0a] border border-[#222] py-5 px-10 rounded-lg flex-shrink-0 flex items-center justify-center mb-4">
        <h1 className="text-white text-4xl font-black uppercase tracking-[0.2em]">
          Queue Times
        </h1>
      </header>

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
              style={{ height: `${rowHeight}px`, minHeight: '60px' }}
            />
          ))}
        </div>
      </main>

      {/* Footer bar — Park closing time + page indicator */}
      <footer className="bg-[#0a0a0a] border border-[#222] py-4 px-10 rounded-lg flex-shrink-0 mt-4">
        <div className="flex items-center justify-between">
          {/* Page dots (left) */}
          <div className="flex items-center gap-2 min-w-[80px]">
            {totalPages > 1 &&
              Array.from({ length: totalPages }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                    i === currentPage ? 'bg-white' : 'bg-white/40'
                  }`}
                />
              ))
            }
          </div>

          {/* Closing time (center) */}
          <div className="flex items-center justify-center gap-4">
            <span className="text-white/50 text-lg font-semibold uppercase tracking-wider">
              Park Closes
            </span>
            <span className="text-white text-2xl font-black tabular-nums">
              {formatTime12h(closingTime)}
            </span>
          </div>

          {/* Spacer (right) */}
          <div className="min-w-[80px]" />
        </div>
      </footer>
    </div>
  );
}
