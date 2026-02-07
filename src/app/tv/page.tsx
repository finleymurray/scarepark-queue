'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Attraction, AttractionStatus } from '@/types/database';

function StatusDisplay({ attraction }: { attraction: Attraction }) {
  const status = attraction.status as AttractionStatus;

  if (status === 'DELAYED') {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-delay-orange text-2xl font-bold tracking-wider animate-pulse-glow sm:text-3xl lg:text-4xl">
          TECHNICAL
        </span>
        <span className="text-delay-yellow text-2xl font-bold tracking-wider animate-pulse-glow sm:text-3xl lg:text-4xl">
          DELAY
        </span>
      </div>
    );
  }

  if (status === 'CLOSED') {
    return (
      <span className="text-blood-bright text-3xl font-bold tracking-widest animate-pulse-glow sm:text-4xl lg:text-5xl">
        CLOSED
      </span>
    );
  }

  if (status === 'AT CAPACITY') {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-capacity-amber text-2xl font-bold tracking-wider animate-pulse-glow sm:text-3xl lg:text-4xl">
          AT
        </span>
        <span className="text-capacity-amber text-2xl font-bold tracking-wider animate-pulse-glow sm:text-3xl lg:text-4xl">
          CAPACITY
        </span>
      </div>
    );
  }

  // OPEN — show wait time
  return (
    <div className="flex flex-col items-center">
      <span className="text-blood-glow text-6xl font-bold tabular-nums sm:text-7xl lg:text-8xl"
            style={{ textShadow: '0 0 20px rgba(255,0,0,0.5), 0 0 40px rgba(255,0,0,0.3)' }}>
        {attraction.wait_time}
      </span>
      <span className="text-bone/70 text-lg font-medium uppercase tracking-widest sm:text-xl">
        min
      </span>
    </div>
  );
}

function AttractionCard({ attraction }: { attraction: Attraction }) {
  return (
    <div className="horror-card rounded-xl p-6 flex flex-col items-center justify-between gap-4 min-h-[200px] animate-pulse-red sm:p-8 lg:min-h-[260px]">
      {/* Attraction Name */}
      <h2 className="text-center text-2xl text-bone blood-drip sm:text-3xl lg:text-4xl"
          style={{ fontFamily: 'var(--font-horror)' }}>
        {attraction.name}
      </h2>

      {/* Status / Time Display */}
      <div className="flex flex-1 items-center justify-center">
        <StatusDisplay attraction={attraction} />
      </div>

      {/* Subtle status indicator bar at bottom */}
      <div className="w-full h-1 rounded-full overflow-hidden bg-black/50">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            attraction.status === 'OPEN'
              ? 'bg-blood-bright w-full'
              : attraction.status === 'DELAYED'
              ? 'bg-delay-orange w-2/3'
              : attraction.status === 'AT CAPACITY'
              ? 'bg-capacity-amber w-full'
              : 'bg-blood/50 w-1/4'
          }`}
        />
      </div>
    </div>
  );
}

export default function TVDisplay() {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAttractions() {
      const { data, error } = await supabase
        .from('attractions')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error fetching attractions:', error);
        return;
      }
      setAttractions(data || []);
      setLoading(false);
    }

    fetchAttractions();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('tv-display')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attractions',
        },
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="text-center">
          <h1 className="text-blood-bright text-4xl animate-flicker mb-4"
              style={{ fontFamily: 'var(--font-horror)' }}>
            Loading...
          </h1>
          <div className="w-16 h-1 bg-blood mx-auto rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="mb-6 text-center sm:mb-8 lg:mb-10">
        <h1 className="text-blood-bright text-4xl animate-flicker blood-drip sm:text-5xl lg:text-6xl"
            style={{ fontFamily: 'var(--font-horror)' }}>
          Queue Times
        </h1>
        <div className="mt-4 mx-auto w-48 h-0.5 bg-gradient-to-r from-transparent via-blood to-transparent" />
      </header>

      {/*
        Orientation-responsive grid:
        - Portrait: single column (via CSS media query in globals.css)
        - Landscape: multi-column auto-fit grid
        The .tv-grid class handles orientation detection
      */}
      <div className="tv-grid">
        {attractions.map((attraction) => (
          <AttractionCard key={attraction.id} attraction={attraction} />
        ))}
      </div>
    </div>
  );
}
