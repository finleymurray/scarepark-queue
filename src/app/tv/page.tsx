'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Attraction, AttractionStatus, ParkSetting } from '@/types/database';

function ClockIcon() {
  return (
    <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function AttractionRow({ attraction }: { attraction: Attraction }) {
  const status = attraction.status as AttractionStatus;

  return (
    <div className="flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5 border-b border-white/10 last:border-b-0 transition-colors">
      {/* Left: Attraction name */}
      <div className="flex-1 min-w-0 mr-4">
        <h3 className="text-white text-lg font-semibold truncate sm:text-xl lg:text-2xl">
          {attraction.name}
        </h3>
      </div>

      {/* Right: Status / Time */}
      <div className="flex-shrink-0 text-right">
        {status === 'OPEN' && (
          <div className="flex items-center gap-2 text-white">
            <ClockIcon />
            <span className="text-xl font-bold tabular-nums sm:text-2xl lg:text-3xl">
              {attraction.wait_time}
            </span>
            <span className="text-sm font-semibold uppercase tracking-wider text-white/70 sm:text-base">
              Mins
            </span>
          </div>
        )}
        {status === 'CLOSED' && (
          <span className="text-blood-bright text-xl font-bold italic sm:text-2xl lg:text-3xl">
            Closed
          </span>
        )}
        {status === 'DELAYED' && (
          <span className="text-delay-orange text-lg font-bold sm:text-xl lg:text-2xl">
            Technical Delay
          </span>
        )}
        {status === 'AT CAPACITY' && (
          <span className="text-capacity-amber text-lg font-bold sm:text-xl lg:text-2xl">
            At Capacity
          </span>
        )}
      </div>
    </div>
  );
}

function formatClosingTime(time: string): string {
  if (!time) return '--:--';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${m} ${ampm}`;
}

const PAGE_INTERVAL = 10000; // 10 seconds between page switches

export default function TVDisplay() {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [closingTime, setClosingTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [perPage, setPerPage] = useState<number | null>(null);
  const [fading, setFading] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  // Calculate how many rows fit in the available space
  const calculatePerPage = useCallback(() => {
    if (!rowRef.current || !mainRef.current) return;
    const rowHeight = rowRef.current.getBoundingClientRect().height;
    if (rowHeight === 0) return;
    const mainHeight = mainRef.current.getBoundingClientRect().height;
    const fits = Math.max(1, Math.floor(mainHeight / rowHeight));
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

  // Measure row height after first render and on resize
  useEffect(() => {
    if (loading || attractions.length === 0) return;

    // Small delay to let DOM settle
    const timer = setTimeout(calculatePerPage, 100);

    const handleResize = () => calculatePerPage();
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [loading, attractions.length, calculatePerPage]);

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
      // Start fade out
      setFading(true);
      setTimeout(() => {
        setCurrentPage((prev) => (prev + 1) % totalPages);
        // Fade back in
        setFading(false);
      }, 400);
    }, PAGE_INTERVAL);

    return () => clearInterval(interval);
  }, [totalPages]);

  // Reset current page if it's out of bounds
  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(0);
    }
  }, [currentPage, totalPages]);

  // Slice attractions for current page
  const visibleAttractions = perPage && totalPages > 1
    ? attractions.slice(currentPage * perPage, (currentPage + 1) * perPage)
    : attractions;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <h1 className="text-white/60 text-2xl font-semibold">Loading...</h1>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Header banner */}
      <header className="bg-gradient-to-r from-blood via-gore to-blood py-5 px-6 sm:py-6 sm:px-10 flex-shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-white text-2xl font-black uppercase tracking-wider sm:text-3xl lg:text-4xl">
            Queue Times
          </h1>
          <div className="text-white/80 text-sm font-medium sm:text-base">
            Scarepark
          </div>
        </div>
      </header>

      {/* Attraction list */}
      <main ref={mainRef} className="flex-1 max-w-5xl mx-auto w-full overflow-hidden">
        <div
          className="bg-[#0a0a0a] divide-y divide-white/10 transition-opacity duration-400"
          style={{ opacity: fading ? 0 : 1 }}
        >
          {visibleAttractions.map((attraction, index) => (
            <div key={attraction.id} ref={index === 0 ? rowRef : undefined}>
              <AttractionRow attraction={attraction} />
            </div>
          ))}
        </div>
      </main>

      {/* Footer bar — Park closing time + page indicator */}
      <footer className="bg-gradient-to-r from-[#1a1a2e] via-[#16163a] to-[#1a1a2e] py-4 px-6 sm:py-5 sm:px-10 flex-shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          {/* Page dots (left) — only shown when paginating */}
          <div className="flex items-center gap-1.5 min-w-[60px]">
            {totalPages > 1 &&
              Array.from({ length: totalPages }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                    i === currentPage ? 'bg-white' : 'bg-white/30'
                  }`}
                />
              ))
            }
          </div>

          {/* Closing time (center) */}
          <div className="flex items-center justify-center gap-3">
            <span className="text-closing-light text-base font-semibold uppercase tracking-wider sm:text-lg">
              Park Closes
            </span>
            <span className="text-white text-xl font-black tabular-nums sm:text-2xl">
              {formatClosingTime(closingTime)}
            </span>
          </div>

          {/* Spacer (right) to balance the layout */}
          <div className="min-w-[60px]" />
        </div>
      </footer>
    </div>
  );
}
