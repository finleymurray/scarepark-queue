'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Attraction, AttractionStatus, ParkSetting } from '@/types/database';

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

/* ── Row styles matching concept ── */
const rideRowStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.18) 0%, rgba(34, 197, 94, 0.08) 100%)',
  border: '1px solid rgba(34, 197, 94, 0.25)',
  boxShadow: 'inset 0 1px 0 rgba(34, 197, 94, 0.12), 0 2px 8px rgba(0,0,0,0.3)',
};

const showRowStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.4) 0%, rgba(88, 28, 135, 0.2) 100%)',
  border: '1px solid rgba(168, 85, 247, 0.25)',
  boxShadow: 'inset 0 1px 0 rgba(168, 85, 247, 0.1), 0 2px 8px rgba(0,0,0,0.3)',
};

function AttractionRow({ attraction, height }: { attraction: Attraction; height: number }) {
  const status = attraction.status as AttractionStatus;
  const isShow = attraction.attraction_type === 'show';
  const nextShow = isShow ? getNextShowTime(attraction.show_times) : null;

  return (
    <div
      style={{
        ...(isShow ? showRowStyle : rideRowStyle),
        height: `${height}px`,
        minHeight: 50,
        borderRadius: 14,
        paddingLeft: '3%',
        paddingRight: '3%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        overflow: 'hidden',
      }}
    >
      {/* Left: Name + badge */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
        <span
          style={{
            fontSize: '1.6vw',
            fontWeight: 800,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: '#fff',
          }}
        >
          {attraction.name}
        </span>
        {isShow && (
          <span
            style={{
              flexShrink: 0,
              fontSize: '0.65vw',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 20,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              background: 'rgba(168, 85, 247, 0.3)',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              color: 'rgba(200, 170, 255, 0.9)',
            }}
          >
            Live Show
          </span>
        )}
      </div>

      {/* Right: Status */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        {status === 'CLOSED' && (
          <span
            style={{
              background: 'rgba(220, 53, 69, 0.15)',
              border: '1px solid rgba(220, 53, 69, 0.3)',
              color: '#f87171',
              fontSize: '1.1vw',
              fontWeight: 700,
              padding: '4px 16px',
              borderRadius: 8,
            }}
          >
            Closed
          </span>
        )}
        {status === 'DELAYED' && (
          <span
            style={{
              background: 'rgba(240, 173, 78, 0.15)',
              border: '1px solid rgba(240, 173, 78, 0.3)',
              color: '#f0ad4e',
              fontSize: '1.1vw',
              fontWeight: 700,
              padding: '4px 16px',
              borderRadius: 8,
            }}
          >
            Technical Delay
          </span>
        )}
        {status === 'AT CAPACITY' && (
          <span
            style={{
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#F59E0B',
              fontSize: '1.1vw',
              fontWeight: 700,
              padding: '4px 16px',
              borderRadius: 8,
            }}
          >
            At Capacity
          </span>
        )}
        {status === 'OPEN' && isShow && (
          <>
            <span
              style={{
                fontSize: '0.9vw',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.45)',
              }}
            >
              Next Show
            </span>
            <span
              style={{
                fontSize: '2.2vw',
                fontWeight: 900,
                fontVariantNumeric: 'tabular-nums',
                color: '#fff',
              }}
            >
              {nextShow ? formatTime12h(nextShow) : 'No More Shows'}
            </span>
          </>
        )}
        {status === 'OPEN' && !isShow && (
          <>
            <span
              style={{
                fontSize: '2.2vw',
                fontWeight: 900,
                fontVariantNumeric: 'tabular-nums',
                color: '#fff',
              }}
            >
              {attraction.wait_time}
            </span>
            <span
              style={{
                fontSize: '0.9vw',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.45)',
              }}
            >
              Mins
            </span>
          </>
        )}
      </div>
    </div>
  );
}

const TV_SAFE_PADDING = '3.5%';

export default function TVDisplay() {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [closingTime, setClosingTime] = useState('');
  const [autoSort, setAutoSort] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mainHeight, setMainHeight] = useState(0);
  const [now, setNow] = useState(Date.now());
  const mainRef = useRef<HTMLDivElement>(null);

  // Tick every 30s so show times auto-advance
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const measureHeight = useCallback(() => {
    if (!mainRef.current) return;
    setMainHeight(mainRef.current.getBoundingClientRect().height);
  }, []);

  useEffect(() => {
    async function fetchData() {
      const [attractionsRes, closingRes, autoSortRes] = await Promise.all([
        supabase.from('attractions').select('id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at').order('sort_order', { ascending: true }),
        supabase.from('park_settings').select('key,value').eq('key', 'closing_time').single(),
        supabase.from('park_settings').select('key,value').eq('key', 'auto_sort_by_wait').single(),
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
      .channel('tv1-attractions')
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
      .channel('tv1-settings')
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

    const timer = setTimeout(measureHeight, 100);

    const handleResize = () => measureHeight();
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [loading, measureHeight]);

  // When auto-sort is on, sort by wait_time descending (OPEN rides first, then others)
  const sortedAttractions = autoSort
    ? [...attractions].sort((a, b) => {
        const aOpen = a.status === 'OPEN' ? 1 : 0;
        const bOpen = b.status === 'OPEN' ? 1 : 0;
        if (aOpen !== bOpen) return bOpen - aOpen;
        return b.wait_time - a.wait_time;
      })
    : attractions;

  const count = sortedAttractions.length;
  const gap = 8;
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
      style={{
        height: '100vh',
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        paddingLeft: TV_SAFE_PADDING,
        paddingRight: TV_SAFE_PADDING,
        paddingTop: '2%',
        paddingBottom: '2%',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: '#fff',
      }}
    >
      {/* Header */}
      <header
        style={{
          background: 'linear-gradient(135deg, rgba(20,20,20,0.9), rgba(10,10,10,0.95))',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: '18px 40px',
          textAlign: 'center',
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            fontSize: '2.2vw',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            background: 'linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.7) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
          }}
        >
          Queue Times
        </h1>
      </header>

      {/* Rows */}
      <main
        ref={mainRef}
        style={{ flex: 1, overflow: 'hidden' }}
      >
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: `${gap}px`,
          }}
        >
          {sortedAttractions.map((attraction) => (
            <AttractionRow
              key={attraction.id}
              attraction={attraction}
              height={rowHeight}
            />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          background: 'linear-gradient(135deg, rgba(20,20,20,0.9), rgba(10,10,10,0.95))',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: '14px 40px',
          marginTop: 8,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
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
            color: '#fff',
          }}
        >
          {formatTime12h(closingTime)}
        </span>
      </footer>
    </div>
  );
}
