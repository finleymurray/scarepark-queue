'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Attraction, ParkSetting } from '@/types/database';
import { resolveBg, resolveLogo } from '@/lib/logos';
import { useConnectionHealth } from '@/hooks/useConnectionHealth';
import { useScreenIdentity } from '@/hooks/useScreenIdentity';
import ParkClosedOverlay from '@/components/ParkClosedOverlay';
import BannerBoard from '@/components/tv/BannerBoard';
import ShowsBoard from '@/components/tv/ShowsBoard';
import TvFooter from '@/components/tv/TvFooter';

const ATTRACTION_SELECT =
  'id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at,logo_url,bg_url,queue_bg_url,glow_rgb,text_color,text_rgb,tagline';

const VIEW_DURATION = 20000; // 20s per view before switching

/**
 * TV4 — alternating board carousel: the TV2.5 wait-times board, then the
 * TV3 shows board, crossfading every 20s. One fetch + one realtime channel.
 * If there are no shows configured, it just stays on the wait-times board.
 * No iframes, no per-frame JS — Pi 3/4 safe.
 */
export default function TV4Page() {
  useConnectionHealth('tv4');
  useScreenIdentity('/tv4');

  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [autoSort, setAutoSort] = useState(false);
  const [closingTime, setClosingTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'rides' | 'shows'>('rides');
  const [, setTick] = useState(0);

  const shows = attractions.filter((a) => a.attraction_type === 'show');
  const hasShows = shows.length > 0;
  const hasShowsRef = useRef(hasShows);
  hasShowsRef.current = hasShows;

  // 30s tick so show times auto-advance while the shows board is up
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Alternate views; only flip to shows when shows exist
  useEffect(() => {
    if (loading) return;
    const interval = setInterval(() => {
      setView((v) => (v === 'rides' && hasShowsRef.current ? 'shows' : 'rides'));
    }, VIEW_DURATION);
    return () => clearInterval(interval);
  }, [loading]);

  // If shows disappear while showing the shows board, fall back to rides
  useEffect(() => {
    if (!hasShows && view === 'shows') setView('rides');
  }, [hasShows, view]);

  useEffect(() => {
    async function fetchData() {
      const [attractionsRes, autoSortRes, closingRes] = await Promise.all([
        supabase.from('attractions').select(ATTRACTION_SELECT).order('sort_order', { ascending: true }),
        supabase.from('park_settings').select('key,value').eq('key', 'auto_sort_by_wait').single(),
        supabase.from('park_settings').select('key,value').eq('key', 'closing_time').single(),
      ]);
      if (!attractionsRes.error) setAttractions(attractionsRes.data || []);
      if (autoSortRes.data) setAutoSort(autoSortRes.data.value === 'true');
      if (closingRes.data) setClosingTime(closingRes.data.value);
      setLoading(false);
    }

    fetchData();

    const attractionsChannel = supabase
      .channel('tv4-attractions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attractions' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setAttractions((prev) => prev.map((a) => (a.id === (payload.new as Attraction).id ? (payload.new as Attraction) : a)));
        } else if (payload.eventType === 'INSERT') {
          setAttractions((prev) => [...prev, payload.new as Attraction].sort((a, b) => a.sort_order - b.sort_order));
        } else if (payload.eventType === 'DELETE') {
          setAttractions((prev) => prev.filter((a) => a.id !== (payload.old as Attraction).id));
        }
      })
      .subscribe();

    const settingsChannel = supabase
      .channel('tv4-settings')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'park_settings' }, (payload) => {
        const setting = payload.new as ParkSetting;
        if (setting.key === 'auto_sort_by_wait') setAutoSort(setting.value === 'true');
        if (setting.key === 'closing_time') setClosingTime(setting.value);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(attractionsChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, []);

  // Preload show artwork so the shows board doesn't pop in on first switch
  useEffect(() => {
    shows.forEach((a) => {
      const bg = resolveBg(a);
      const logo = resolveLogo(a);
      if (bg) { const img = new Image(); img.src = bg; }
      if (logo) { const img = new Image(); img.src = logo; }
    });
  }, [shows]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#07080B' }}>
        <h1 className="text-white/60 text-2xl font-semibold">Loading...</h1>
      </div>
    );
  }

  const activeView = hasShows ? view : 'rides';

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#07080B', overflow: 'hidden', color: '#fff' }}>
      <ParkClosedOverlay />
      <style>{`.tv4-view{animation:tv4fade 600ms ease}@keyframes tv4fade{from{opacity:0}to{opacity:1}}`}</style>

      {/* Keyed wrapper → fade-in on each view switch */}
      <div key={activeView} className="tv4-view" style={{ position: 'absolute', inset: 0 }}>
        {activeView === 'rides' ? (
          <BannerBoard attractions={attractions} autoSort={autoSort} closingTime={closingTime} />
        ) : (
          <ShowsBoard shows={shows} closingTime={closingTime} />
        )}
      </div>

      {/* Brand strip footer overlaid at the very bottom */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20 }}>
        <TvFooter />
      </div>
    </div>
  );
}
