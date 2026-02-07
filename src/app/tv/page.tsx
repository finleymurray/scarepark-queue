'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Attraction, AttractionStatus, ParkSetting } from '@/types/database';

function StatusDisplay({ attraction }: { attraction: Attraction }) {
  const status = attraction.status as AttractionStatus;

  if (status === 'DELAYED') {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-delay-orange text-2xl font-bold tracking-wider sm:text-3xl lg:text-4xl">
          TECHNICAL
        </span>
        <span className="text-delay-yellow text-2xl font-bold tracking-wider sm:text-3xl lg:text-4xl">
          DELAY
        </span>
      </div>
    );
  }

  if (status === 'CLOSED') {
    return (
      <span className="text-blood-bright text-3xl font-bold tracking-widest sm:text-4xl lg:text-5xl">
        CLOSED
      </span>
    );
  }

  if (status === 'AT CAPACITY') {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-capacity-amber text-2xl font-bold tracking-wider sm:text-3xl lg:text-4xl">
          AT
        </span>
        <span className="text-capacity-amber text-2xl font-bold tracking-wider sm:text-3xl lg:text-4xl">
          CAPACITY
        </span>
      </div>
    );
  }

  // OPEN — show wait time
  return (
    <div className="flex flex-col items-center">
      <span className="text-blood-glow text-6xl font-black tabular-nums sm:text-7xl lg:text-8xl">
        {attraction.wait_time}
      </span>
      <span className="text-bone/60 text-lg font-semibold uppercase tracking-widest sm:text-xl">
        min
      </span>
    </div>
  );
}

function AttractionCard({ attraction }: { attraction: Attraction }) {
  return (
    <div className="horror-card rounded-xl p-6 flex flex-col items-center justify-between gap-4 min-h-[200px] sm:p-8 lg:min-h-[240px]">
      <h2 className="text-center text-xl font-bold text-bone uppercase tracking-wide sm:text-2xl lg:text-3xl">
        {attraction.name}
      </h2>

      <div className="flex flex-1 items-center justify-center">
        <StatusDisplay attraction={attraction} />
      </div>
    </div>
  );
}

function ClosingTimeCard({ closingTime }: { closingTime: string }) {
  return (
    <div className="closing-card rounded-xl p-6 flex flex-col items-center justify-between gap-4 min-h-[200px] sm:p-8 lg:min-h-[240px]">
      <h2 className="text-center text-xl font-bold text-closing-light uppercase tracking-wide sm:text-2xl lg:text-3xl">
        Park Closing
      </h2>

      <div className="flex flex-1 items-center justify-center">
        <span className="text-closing-light text-5xl font-black tabular-nums sm:text-6xl lg:text-7xl">
          {closingTime || '--:--'}
        </span>
      </div>
    </div>
  );
}

export default function TVDisplay() {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [closingTime, setClosingTime] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [attractionsRes, settingsRes] = await Promise.all([
        supabase.from('attractions').select('*').order('sort_order', { ascending: true }),
        supabase.from('park_settings').select('*').eq('key', 'closing_time').single(),
      ]);

      if (attractionsRes.error) {
        console.error('Error fetching attractions:', attractionsRes.error);
      } else {
        setAttractions(attractionsRes.data || []);
      }

      if (settingsRes.data) {
        setClosingTime(settingsRes.data.value);
      }

      setLoading(false);
    }

    fetchData();

    // Subscribe to attraction changes
    const attractionsChannel = supabase
      .channel('tv-attractions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attractions' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setAttractions((prev) =>
              prev.map((a) =>
                a.id === (payload.new as Attraction).id
                  ? (payload.new as Attraction)
                  : a
              )
            );
          } else if (payload.eventType === 'INSERT') {
            setAttractions((prev) =>
              [...prev, payload.new as Attraction].sort(
                (a, b) => a.sort_order - b.sort_order
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setAttractions((prev) =>
              prev.filter((a) => a.id !== (payload.old as Attraction).id)
            );
          }
        }
      )
      .subscribe();

    // Subscribe to park settings changes (closing time)
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="text-center">
          <h1 className="text-blood-bright text-3xl font-bold mb-4">
            Loading...
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 sm:p-6 lg:p-8">
      <header className="mb-6 text-center sm:mb-8 lg:mb-10">
        <h1 className="text-blood-bright text-4xl font-black uppercase tracking-wider sm:text-5xl lg:text-6xl">
          Queue Times
        </h1>
        <div className="mt-3 mx-auto w-48 h-0.5 bg-gradient-to-r from-transparent via-blood to-transparent" />
      </header>

      <div className="tv-grid">
        {attractions.map((attraction) => (
          <AttractionCard key={attraction.id} attraction={attraction} />
        ))}
        <ClosingTimeCard closingTime={closingTime} />
      </div>
    </div>
  );
}
