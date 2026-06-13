'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Attraction, ParkSetting } from '@/types/database';
import { useConnectionHealth } from '@/hooks/useConnectionHealth';
import { useScreenIdentity } from '@/hooks/useScreenIdentity';
import ParkClosedOverlay from '@/components/ParkClosedOverlay';
import BannerBoard from '@/components/tv/BannerBoard';
import TvFooter from '@/components/tv/TvFooter';

const ATTRACTION_SELECT =
  'id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at,logo_url,bg_url,queue_bg_url,glow_rgb,text_color,text_rgb,tagline';

/**
 * TV2.5 — standalone compact 4-up "Wait Times" board.
 *
 * Renders the shared BannerBoard (same design as TV4's rides view) full-screen,
 * with its own data fetch + realtime channels, plus the brand-strip footer.
 * The board's header carries the Closes pill, so the footer omits closeTime.
 */
export default function TV25Display() {
  useConnectionHealth('tv2.5');
  useScreenIdentity('/tv2.5');
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [autoSort, setAutoSort] = useState(false);
  const [closingTime, setClosingTime] = useState('');
  const [loading, setLoading] = useState(true);

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
      .channel('tv25b-attractions')
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
      .channel('tv25b-settings')
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#07080B' }}>
        <h1 className="text-white/60 text-2xl font-semibold">Loading...</h1>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#07080B',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: '#fff',
      }}
    >
      <ParkClosedOverlay />

      {/* Banner board — closes pill lives in the board header */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <BannerBoard attractions={attractions} autoSort={autoSort} closingTime={closingTime} />
      </div>

      {/* Footer — brand strip only (no closeTime; the board header has the pill) */}
      <footer style={{ flexShrink: 0 }}>
        <TvFooter />
      </footer>
    </div>
  );
}
