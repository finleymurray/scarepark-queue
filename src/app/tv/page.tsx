'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Attraction, AttractionStatus, ParkSetting } from '@/types/database';

function ClockIcon() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
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

/** Given sorted show_times ["18:00","19:30","21:00"], return the next one after now */
function getNextShowTime(showTimes: string[] | null): string | null {
  if (!showTimes || showTimes.length === 0) return null;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const sorted = [...showTimes].sort();

  for (const time of sorted) {
    const [h, m] = time.split(':');
    const timeMinutes = parseInt(h, 10) * 60 + parseInt(m, 10);
    if (timeMinutes > nowMinutes) {
      return time;
    }
  }

  // All shows have passed — return null (no more shows today)
  return null;
}

function AttractionRow({ attraction, style, now }: { attraction: Attraction; style?: React.CSSProperties; now: number }) {
  const status = attraction.status as AttractionStatus;
  const isShow = attraction.attraction_type === 'show';
  const nextShow = isShow ? getNextShowTime(attraction.show_times) : null;

  return (
    <div
      className={`flex items-center justify-between rounded-lg border ${
        isShow
          ? 'bg-purple-950/30 border-purple-500/20'
          : 'bg-white/[0.04] border-white/[0.08]'
      }`}
      style={{ ...style, paddingLeft: '3%', paddingRight: '3%' }}
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
              {nextShow ? formatTime12h(nextShow) : 'No More Shows'}
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

const PAGE_INTERVAL = 10000;
const TV_SAFE_PADDING = '3.5%';

export default function TVDisplay() {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [closingTime, setClosingTime] = useState('');
  const [autoSort, setAutoSort] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [perPage, setPerPage] = useState<number | null>(null);
  const [fading, setFading] = useState(false);
  const [mainHeight, setMainHeight] = useState(0);
  const [now, setNow] = useState(Date.now());
  const mainRef = useRef<HTMLDivElement>(null);

  // Tick every 30s so show times auto-advance
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const calculatePerPage = useCallback(() => {
    if (!mainRef.current) return;
    const available = mainRef.current.getBoundingClientRect().height;
    setMainHeight(available);
    const estimatedRowHeight = 82;
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

  const totalPages = perPage && perPage < attractions.length
    ? Math.ceil(attractions.length / perPage)
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

  // When auto-sort is on, sort by wait_time descending (OPEN rides first, then others)
  const sortedAttractions = autoSort
    ? [...attractions].sort((a, b) => {
        const aOpen = a.status === 'OPEN' ? 1 : 0;
        const bOpen = b.status === 'OPEN' ? 1 : 0;
        if (aOpen !== bOpen) return bOpen - aOpen;
        return b.wait_time - a.wait_time;
      })
    : attractions;

  const visibleAttractions = perPage && totalPages > 1
    ? sortedAttractions.slice(currentPage * perPage, (currentPage + 1) * perPage)
    : sortedAttractions;

  const count = visibleAttractions.length;
  const gap = 12;
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
      <header className="bg-gradient-to-r from-blood via-gore to-blood py-4 px-10 rounded-lg flex-shrink-0">
        <h1 className="text-white text-3xl font-black uppercase tracking-wider">
          Queue Times
        </h1>
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
              now={now}
            />
          ))}
        </div>
      </main>

      {/* Footer bar — Park closing time + page indicator */}
      <footer className="bg-gradient-to-r from-[#1a1a2e] via-[#16163a] to-[#1a1a2e] py-4 px-10 rounded-lg flex-shrink-0">
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
