'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
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

const TV_SAFE_PADDING = '3.5%';

export default function TV3ShowTimes() {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [closingTime, setClosingTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

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
        paddingLeft: TV_SAFE_PADDING,
        paddingRight: TV_SAFE_PADDING,
        paddingTop: '2%',
        paddingBottom: '2%',
      }}
    >
      {/* Show Cards Grid */}
      <main className="flex-1 flex items-center justify-center overflow-hidden">
        {shows.length === 0 ? (
          <p className="text-white/30 text-2xl">No shows configured</p>
        ) : (
          <div
            className="w-full h-full grid gap-6 items-stretch"
            style={{
              gridTemplateColumns: `repeat(${shows.length}, 1fr)`,
            }}
          >
            {shows.map((show) => {
              const nextShow = getNextShowTime(show.show_times);

              return (
                <div
                  key={show.id}
                  className="grid rounded-2xl border-2 border-purple-500/30 bg-purple-950/40"
                  style={{
                    padding: '5% 4%',
                    gridTemplateRows: '1fr auto auto',
                  }}
                >
                  {/* Show Name — vertically centered in its row */}
                  <div className="flex items-end justify-center pb-[4%]">
                    <h2 className="text-white text-[4vw] font-black text-center leading-tight">
                      {show.name}
                    </h2>
                  </div>

                  {/* "Next Show" label — fixed row */}
                  <div className="flex items-center justify-center py-[1%]">
                    {show.status === 'DELAYED' ? (
                      <p className="text-[#f0ad4e] text-[3.5vw] font-bold">Delayed</p>
                    ) : nextShow ? (
                      <p className="text-white/50 text-[1.5vw] font-semibold uppercase tracking-wider">
                        Next Show
                      </p>
                    ) : (
                      <p className="text-white/30 text-[1.5vw] font-semibold uppercase tracking-wider">
                        &nbsp;
                      </p>
                    )}
                  </div>

                  {/* Time — fixed row */}
                  <div className="flex items-start justify-center pt-[1%]">
                    {show.status === 'DELAYED' ? null : nextShow ? (
                      <p className="text-white text-[5vw] font-black tabular-nums leading-none">
                        {formatTime12h(nextShow)}
                      </p>
                    ) : (
                      <p className="text-white/30 text-[2.5vw] font-bold">No More Shows</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer — Park closing time */}
      <footer className="bg-[#0a0a0a] border border-[#222] py-4 px-10 rounded-lg flex-shrink-0 mt-8">
        <div className="flex items-center justify-center gap-4">
          <span className="text-white/50 text-lg font-semibold uppercase tracking-wider">
            Park Closes
          </span>
          <span className="text-white text-2xl font-black tabular-nums">
            {formatTime12h(closingTime)}
          </span>
        </div>
      </footer>
    </div>
  );
}
