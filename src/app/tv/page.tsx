'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Attraction, AttractionStatus, AttractionType, ParkSetting } from '@/types/database';

function ClockIcon() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function AttractionRow({ attraction, style }: { attraction: Attraction; style?: React.CSSProperties }) {
  const status = attraction.status as AttractionStatus;
  const isShow = attraction.attraction_type === 'show';

  return (
    <div
      className={`flex items-center justify-between px-8 rounded-lg border ${
        isShow
          ? 'bg-purple-950/30 border-purple-500/20'
          : 'bg-white/[0.04] border-white/[0.08]'
      }`}
      style={style}
    >
      {/* Left: Attraction name + type badge */}
      <div className="flex-1 min-w-0 mr-6 flex items-center gap-4">
        <h3 className="text-white text-2xl font-bold truncate">
          {attraction.name}
        </h3>
        {isShow && (
          <span className="flex-shrink-0 bg-purple-700 text-white text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
            Live Show
          </span>
        )}
      </div>

      {/* Right: Status / Time / Show time */}
      <div className="flex-shrink-0 text-right">
        {status === 'CLOSED' && (
          <span className="text-blood-bright text-2xl font-bold italic">
            Closed
          </span>
        )}
        {status === 'DELAYED' && (
          <span className="text-delay-orange text-2xl font-bold">
            Technical Delay
          </span>
        )}
        {status === 'AT CAPACITY' && (
          <span className="text-capacity-amber text-2xl font-bold">
            At Capacity
          </span>
        )}
        {status === 'OPEN' && isShow && (
          <div className="flex items-center gap-3">
            <span className="text-purple-300 text-base font-semibold uppercase tracking-wider">
              Next Show
            </span>
            <span className="text-white text-3xl font-black tabular-nums">
              {attraction.next_show_time
                ? formatTime12h(attraction.next_show_time)
                : '--:--'}
            </span>
          </div>
        )}
        {status === 'OPEN' && !isShow && (
          <div className="flex items-center gap-3 text-white">
            <ClockIcon />
            <span className="text-3xl font-black tabular-nums">
              {attraction.wait_time}
            </span>
            <span className="text-base font-semibold uppercase tracking-wider text-white/60">
              Mins
            </span>
          </div>
        )}
      </div>
    </div>
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

const PAGE_INTERVAL = 10000; // 10 seconds between page switches
const TV_SAFE_PADDING = '3.5%'; // TV overscan safe area

export default function TVDisplay() {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [closingTime, setClosingTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [perPage, setPerPage] = useState<number | null>(null);
  const [fading, setFading] = useState(false);
  const [mainHeight, setMainHeight] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);

  // Measure how many rows fit — each row needs ~height including gap
  const calculatePerPage = useCallback(() => {
    if (!mainRef.current) return;
    const available = mainRef.current.getBoundingClientRect().height;
    setMainHeight(available);
    // Estimate: each row is roughly 70px + 12px gap = ~82px
    // We'll use a conservative estimate; the actual flex layout will stretch them
    const estimatedRowHeight = 82;
    const fits = Math.max(1, Math.floor(available / estimatedRowHeight));
    setPerPage(fits);
  }, []);

  useEffect(() => {
    async function fetchData() {
      const [attractionsRes, settingsRes] = await Promise.all([
        supabase.from('attractions').select('*').order('sort_order', { ascending: true }),
        supabase.from('park_settings').select('*').eq('key', 'closing_time').single(),
      ]);

      if (!attractionsRes.error) {
        setAttractions(attractionsRes.data || []);
      }
      if (settingsRes.data) {
        setClosingTime(settingsRes.data.value);
      }
      setLoading(false);
    }

    fetchData();

    const attractionsChannel = supabase
      .channel('tv-attractions')
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
      .channel('tv-settings')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'park_settings' },
        (payload) => {
          const setting = payload.new as ParkSetting;
          if (setting.key === 'closing_time') {
            setClosingTime(setting.value);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(attractionsChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, []);

  // Measure available space after render and on resize
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

  // Determine pagination
  const totalPages = perPage && perPage < attractions.length
    ? Math.ceil(attractions.length / perPage)
    : 1;

  // Auto-cycle pages with fade transition
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

  // Reset current page if out of bounds
  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(0);
    }
  }, [currentPage, totalPages]);

  // Slice attractions for current page
  const visibleAttractions = perPage && totalPages > 1
    ? attractions.slice(currentPage * perPage, (currentPage + 1) * perPage)
    : attractions;

  // Calculate row height so they stretch to fill the space evenly
  const count = visibleAttractions.length;
  const gap = 12; // gap between rows in px
  const totalGap = count > 1 ? (count - 1) * gap : 0;
  const rowHeight = count > 0 && mainHeight > 0
    ? Math.floor((mainHeight - totalGap) / count)
    : 70;

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
      <header className="bg-gradient-to-r from-blood via-gore to-blood py-4 px-8 rounded-lg flex-shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-white text-3xl font-black uppercase tracking-wider">
            Queue Times
          </h1>
          <div className="text-white/80 text-lg font-semibold">
            Scarepark
          </div>
        </div>
      </header>

      {/* Attraction list — fills available space */}
      <main ref={mainRef} className="flex-1 overflow-hidden py-3">
        <div
          className="h-full flex flex-col transition-opacity duration-400"
          style={{
            opacity: fading ? 0 : 1,
            gap: `${gap}px`,
          }}
        >
          {visibleAttractions.map((attraction) => (
            <AttractionRow
              key={attraction.id}
              attraction={attraction}
              style={{ height: `${rowHeight}px`, minHeight: '50px' }}
            />
          ))}
        </div>
      </main>

      {/* Footer bar — Park closing time + page indicator */}
      <footer className="bg-gradient-to-r from-[#1a1a2e] via-[#16163a] to-[#1a1a2e] py-4 px-8 rounded-lg flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Page dots (left) */}
          <div className="flex items-center gap-2 min-w-[80px]">
            {totalPages > 1 &&
              Array.from({ length: totalPages }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                    i === currentPage ? 'bg-white' : 'bg-white/30'
                  }`}
                />
              ))
            }
          </div>

          {/* Closing time (center) */}
          <div className="flex items-center justify-center gap-3">
            <span className="text-closing-light text-lg font-semibold uppercase tracking-wider">
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
