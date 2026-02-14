'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getAttractionLogo, getAttractionBg } from '@/lib/logos';
import type { Attraction, ParkSetting } from '@/types/database';

function formatTime12h(time: string): string {
  if (!time) return '--:--';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${m} ${ampm}`;
}

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

  return null;
}

/* ── Clean header/footer — borderline style ── */

const headerStyle: React.CSSProperties = {
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  padding: '1.5vw 0',
  textAlign: 'center' as const,
  marginBottom: '0.8vw',
  flexShrink: 0,
};

const headerTitleStyle: React.CSSProperties = {
  fontSize: '2.5vw',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.2em',
  color: '#fff',
  margin: 0,
};

const footerStyle: React.CSSProperties = {
  borderTop: '1px solid rgba(255,255,255,0.1)',
  padding: '1.2vw 0',
  marginTop: '0.8vw',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'center',
  gap: '1vw',
};

const TV_SAFE_PADDING = '3.5%';

export default function TV3ShowTimes() {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [closingTime, setClosingTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    setIsEmbedded(window.self !== window.top);
  }, []);

  // Tick every 30s so show times auto-advance
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchData() {
      const [attractionsRes, closingRes] = await Promise.all([
        supabase
          .from('attractions')
          .select('id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at')
          .order('sort_order', { ascending: true }),
        supabase.from('park_settings').select('key,value').eq('key', 'closing_time').single(),
      ]);

      if (!attractionsRes.error) {
        setAttractions(attractionsRes.data || []);
      }
      if (closingRes.data) {
        setClosingTime(closingRes.data.value);
      }
      setLoading(false);
    }

    fetchData();

    const attractionsChannel = supabase
      .channel('tv3-attractions')
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
      .channel('tv3-settings')
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

  // Filter to shows only
  const shows = attractions.filter((a) => a.attraction_type === 'show');

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
        gap: 0,
      }}
    >
      {/* Header */}
      {!isEmbedded && (
        <div style={headerStyle}>
          <h1 style={headerTitleStyle}>Show Schedule</h1>
        </div>
      )}

      {/* Show Cards Grid */}
      <main className="flex-1 flex items-center justify-center" style={{ overflow: 'hidden', minHeight: 0 }}>
        {shows.length === 0 ? (
          <p className="text-white/30 text-2xl">No shows configured</p>
        ) : (
          <div
            className="w-full grid items-stretch"
            style={{
              gridTemplateColumns: `repeat(${shows.length}, 1fr)`,
              gap: isEmbedded ? '0.8vw' : '1.5rem',
              height: '100%',
              maxHeight: '100%',
            }}
          >
            {shows.map((show) => {
              const nextShow = getNextShowTime(show.show_times);
              const logo = getAttractionLogo(show.slug);
              const bg = getAttractionBg(show.slug);

              return (
                <div
                  key={show.id}
                  className="relative flex flex-col items-center justify-center rounded-lg overflow-hidden"
                  style={{ padding: '3% 4%', background: bg ? undefined : 'rgba(88, 28, 135, 0.4)', minHeight: 0 }}
                >
                  {/* Background art */}
                  {bg && (
                    <>
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${bg})`, opacity: 0.3, transform: 'scale(1.4)' }}
                      />
                      <div
                        className="absolute inset-0"
                        style={{ background: 'rgba(30, 10, 50, 0.6)' }}
                      />
                    </>
                  )}

                  {/* Logo + Show Time grouped together, centered */}
                  <div className="relative z-10 flex flex-col items-center justify-center gap-[1vw]" style={{ minHeight: 0, maxHeight: '100%' }}>
                    {/* Show Name / Logo */}
                    {logo ? (
                      <img
                        src={logo}
                        alt={show.name}
                        loading="lazy"
                        decoding="async"
                        className="object-contain"
                        style={{
                          width: '95%',
                          maxWidth: 550,
                          height: 'auto',
                          maxHeight: '70%',
                          flexShrink: 1,
                          filter: 'drop-shadow(0 0 25px rgba(168, 85, 247, 0.8)) drop-shadow(0 0 50px rgba(168, 85, 247, 0.5)) drop-shadow(0 0 80px rgba(168, 85, 247, 0.3))',
                        }}
                      />
                    ) : (
                      <h2 className="text-white text-[4vw] font-black text-center leading-tight">
                        {show.name}
                      </h2>
                    )}

                    {/* "Next Show" label */}
                    <div className="text-center">
                      {show.status === 'DELAYED' ? (
                        <p className="text-[#f0ad4e] text-[3.5vw] font-bold" style={{ lineHeight: 1.2, textAlign: 'center' }}>Technical<br />Delay</p>
                      ) : nextShow ? (
                        <>
                          <p className="text-white/70 text-[1.5vw] font-semibold uppercase tracking-wider mb-[0.5vw]">
                            Next Show
                          </p>
                          <p className="text-white text-[4vw] font-black tabular-nums leading-none">
                            {formatTime12h(nextShow)}
                          </p>
                        </>
                      ) : (
                        <p className="text-white/30 text-[2.5vw] font-bold">No More Shows</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      {!isEmbedded && (
        <footer style={footerStyle}>
          <span
            style={{
              fontSize: '1vw',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: 'rgba(255,255,255,0.35)',
            }}
          >
            Park Closes
          </span>
          <span
            style={{
              fontSize: '2.2vw',
              fontWeight: 900,
              fontVariantNumeric: 'tabular-nums',
              color: '#fff',
            }}
          >
            {formatTime12h(closingTime)}
          </span>
        </footer>
      )}
    </div>
  );
}
